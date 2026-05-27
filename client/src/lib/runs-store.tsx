/**
 * runs-store — centralized concurrent-run tracking for Conductor.
 *
 * Design:
 *  - The store does NOT own the chat content. Each "surface" (a ChatMode thread,
 *    a Compare column, an Orchestrate node, a Workspace pane) registers a
 *    handler that knows how to commit streamed tokens into its own UI state.
 *  - The store tracks `activeRuns` and per-surface `queues`. When a surface
 *    submits while busy, the request is queued. When the active run finishes,
 *    the next queued request auto-runs (unless the surface is paused).
 *  - Subscribers can listen at two granularities:
 *      • `subscribe()` — every change (used by the dock for meta updates).
 *      • The tick loop emits "elapsed" updates separately so per-row times
 *        only re-render the row, not the whole dock.
 *  - Cancel = abort the AbortController + mark partial output as "stopped".
 *
 * Why not zustand? The existing codebase uses a custom React-context store.
 * This file follows that pattern — same approach as workspace-store.tsx.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { runCompletion, type ChatMessage } from "./ai-gateway";

// ============================================================
// Types
// ============================================================

export type SurfaceKind = "chat" | "compare" | "orchestrate" | "workspace";

export interface RunRequest {
  /** Stable id for this surface (e.g. "chat-main", `compare-col-${id}`, `pane-${id}`) */
  surfaceId: string;
  /** Surface kind — for the dock's source label */
  surfaceKind: SurfaceKind;
  /** Human label, e.g. "Workspace · pane 2" or "Compare · GPT-5 column" */
  paneLabel: string;
  modelId: string;
  /** Conversation history to send to the model */
  messages: ChatMessage[];
  /** Short preview of the prompt — used for queue list, dock subtitle */
  promptPreview: string;
  /** Any extra options to forward to the gateway (length hint, override) */
  gatewayOptions?: {
    responseOverride?: string;
    chunkDelay?: number;
    lengthHint?: "short" | "medium" | "long";
  };
  /** Allow per-request commit logic in addition to the surface handler */
  onMeta?: { messageId?: string };
}

export interface RunMeta {
  id: string;
  surfaceId: string;
  surfaceKind: SurfaceKind;
  paneLabel: string;
  modelId: string;
  startedAt: number;
  endedAt?: number;
  status: "running" | "stopped" | "done" | "error";
  promptPreview: string;
  partialOutput: string;
  abortController: AbortController;
  /** Hook for the dock's "Jump to pane" — fire this to focus the pane */
  onMeta?: { messageId?: string };
}

export interface SurfaceHandler {
  /** Called with each new total text as the stream progresses */
  onChunk: (req: RunRequest, runId: string, fullText: string) => void;
  /** Called when stream finishes (or is stopped). `finalText` is whatever the
   * surface should commit — partial output on cancel, full text otherwise. */
  onFinish: (
    req: RunRequest,
    runId: string,
    finalText: string,
    status: RunMeta["status"],
  ) => void;
  /** Called when user requests "jump to this run" from the dock */
  onJumpTo?: (req: RunRequest, runId: string) => void;
}

// ============================================================
// Store
// ============================================================

interface RunsState {
  activeRuns: Map<string, RunMeta>;
  queues: Map<string, RunRequest[]>;
  paused: Set<string>;
  /** Generation tick — bumped on any meta change */
  version: number;
  /** Tick counter for elapsed times (1 Hz) */
  timeTick: number;
}

class RunsStore {
  state: RunsState = {
    activeRuns: new Map(),
    queues: new Map(),
    paused: new Set(),
    version: 0,
    timeTick: 0,
  };
  handlers = new Map<string, SurfaceHandler>();
  listeners = new Set<() => void>();
  timeListeners = new Set<() => void>();

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  subscribeTime = (l: () => void) => {
    this.timeListeners.add(l);
    return () => {
      this.timeListeners.delete(l);
    };
  };

  getSnapshot = () => this.state;
  getTimeSnapshot = () => this.state.timeTick;

  emit() {
    this.state = { ...this.state, version: this.state.version + 1 };
    for (const l of this.listeners) l();
  }

  emitTime() {
    this.state = { ...this.state, timeTick: this.state.timeTick + 1 };
    for (const l of this.timeListeners) l();
  }

  registerSurface(surfaceId: string, handler: SurfaceHandler) {
    this.handlers.set(surfaceId, handler);
  }
  unregisterSurface(surfaceId: string) {
    this.handlers.delete(surfaceId);
  }

  // ----------------- queue ops -----------------
  enqueue(req: RunRequest): string {
    const queue = this.state.queues.get(req.surfaceId) ?? [];
    const queueEntry = { ...req, _qid: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    // Attach a queue id so we can edit/cancel it
    (queueEntry as any).queueId = queueEntry._qid;
    const next = new Map(this.state.queues);
    next.set(req.surfaceId, [...queue, queueEntry]);
    this.state = { ...this.state, queues: next };
    this.emit();
    // Try to start it immediately if surface is idle
    this.advanceSurface(req.surfaceId);
    return queueEntry._qid;
  }

  /** Submit a run — if the surface is idle, start now; otherwise queue. */
  submit(req: RunRequest): string {
    const isRunning = Array.from(this.state.activeRuns.values()).some(
      (r) => r.surfaceId === req.surfaceId,
    );
    if (!isRunning && !this.state.paused.has(req.surfaceId)) {
      return this.startNow(req);
    }
    return this.enqueue(req);
  }

  cancelQueued(surfaceId: string, queueId: string) {
    const queue = this.state.queues.get(surfaceId) ?? [];
    const next = new Map(this.state.queues);
    next.set(
      surfaceId,
      queue.filter((q: any) => q.queueId !== queueId),
    );
    this.state = { ...this.state, queues: next };
    this.emit();
  }

  editQueued(surfaceId: string, queueId: string, newPromptPreview: string, newMessages?: ChatMessage[]) {
    const queue = this.state.queues.get(surfaceId) ?? [];
    const next = new Map(this.state.queues);
    next.set(
      surfaceId,
      queue.map((q: any) => {
        if (q.queueId !== queueId) return q;
        return {
          ...q,
          promptPreview: newPromptPreview,
          messages: newMessages ?? q.messages,
        };
      }),
    );
    this.state = { ...this.state, queues: next };
    this.emit();
  }

  reorderQueued(surfaceId: string, fromIndex: number, toIndex: number) {
    const queue = [...(this.state.queues.get(surfaceId) ?? [])];
    if (fromIndex < 0 || fromIndex >= queue.length) return;
    const [item] = queue.splice(fromIndex, 1);
    queue.splice(Math.max(0, Math.min(queue.length, toIndex)), 0, item);
    const next = new Map(this.state.queues);
    next.set(surfaceId, queue);
    this.state = { ...this.state, queues: next };
    this.emit();
  }

  setPaused(surfaceId: string, paused: boolean) {
    const next = new Set(this.state.paused);
    if (paused) next.add(surfaceId);
    else next.delete(surfaceId);
    this.state = { ...this.state, paused: next };
    this.emit();
    if (!paused) this.advanceSurface(surfaceId);
  }

  // ----------------- run ops -----------------
  startNow(req: RunRequest): string {
    const runId = `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const ac = new AbortController();
    const meta: RunMeta = {
      id: runId,
      surfaceId: req.surfaceId,
      surfaceKind: req.surfaceKind,
      paneLabel: req.paneLabel,
      modelId: req.modelId,
      startedAt: Date.now(),
      status: "running",
      promptPreview: req.promptPreview,
      partialOutput: "",
      abortController: ac,
      onMeta: req.onMeta,
    };
    const next = new Map(this.state.activeRuns);
    next.set(runId, meta);
    this.state = { ...this.state, activeRuns: next };
    this.emit();

    // Fire off the stream
    (async () => {
      const handler = this.handlers.get(req.surfaceId);
      let full = "";
      try {
        full = await runCompletion(
          req.modelId,
          req.messages,
          (_chunk, fullText) => {
            full = fullText;
            const m = this.state.activeRuns.get(runId);
            if (m) m.partialOutput = fullText; // mutate ref for elapsed-tick reads
            handler?.onChunk(req, runId, fullText);
          },
          {
            ...(req.gatewayOptions ?? {}),
            signal: ac.signal,
          },
        );
      } catch (e) {
        // ignored — stream finished or was aborted
      }
      const wasAborted = ac.signal.aborted;
      const status: RunMeta["status"] = wasAborted ? "stopped" : "done";
      const m = this.state.activeRuns.get(runId);
      if (m) {
        m.status = status;
        m.endedAt = Date.now();
      }
      const finalText = wasAborted ? this.state.activeRuns.get(runId)?.partialOutput ?? "" : full;
      handler?.onFinish(req, runId, finalText, status);

      // remove the active run after a tiny delay so the dock can flash "done"
      setTimeout(() => {
        const cur = new Map(this.state.activeRuns);
        cur.delete(runId);
        this.state = { ...this.state, activeRuns: cur };
        this.emit();
        this.advanceSurface(req.surfaceId);
      }, 400);
      this.emit();
    })();

    return runId;
  }

  cancel(runId: string) {
    const m = this.state.activeRuns.get(runId);
    if (!m) return;
    m.abortController.abort();
  }

  cancelSurface(surfaceId: string) {
    for (const m of this.state.activeRuns.values()) {
      if (m.surfaceId === surfaceId) m.abortController.abort();
    }
  }

  /** Try to dequeue next request for a surface and run it. */
  advanceSurface(surfaceId: string) {
    if (this.state.paused.has(surfaceId)) return;
    const isRunning = Array.from(this.state.activeRuns.values()).some(
      (r) => r.surfaceId === surfaceId,
    );
    if (isRunning) return;
    const queue = this.state.queues.get(surfaceId) ?? [];
    if (queue.length === 0) return;
    const [next, ...rest] = queue;
    const nextQueues = new Map(this.state.queues);
    nextQueues.set(surfaceId, rest);
    this.state = { ...this.state, queues: nextQueues };
    this.emit();
    this.startNow(next);
  }

  jumpTo(runId: string) {
    const m = this.state.activeRuns.get(runId);
    if (!m) return;
    const handler = this.handlers.get(m.surfaceId);
    // Reconstruct a minimal RunRequest for the jump handler
    handler?.onJumpTo?.(
      {
        surfaceId: m.surfaceId,
        surfaceKind: m.surfaceKind,
        paneLabel: m.paneLabel,
        modelId: m.modelId,
        messages: [],
        promptPreview: m.promptPreview,
      },
      runId,
    );
  }
}

// ============================================================
// React glue
// ============================================================

const RunsContext = createContext<RunsStore | null>(null);

export function RunsProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<RunsStore | null>(null);
  if (!storeRef.current) storeRef.current = new RunsStore();
  const store = storeRef.current;

  // 1 Hz tick for elapsed-time displays — does NOT bump general listeners
  useEffect(() => {
    const t = setInterval(() => store.emitTime(), 1000);
    return () => clearInterval(t);
  }, [store]);

  return <RunsContext.Provider value={store}>{children}</RunsContext.Provider>;
}

export function useRunsStore(): RunsStore {
  const s = useContext(RunsContext);
  if (!s) throw new Error("useRunsStore must be used inside RunsProvider");
  return s;
}

export function useRunsState() {
  const store = useRunsStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function useRunsTimeTick() {
  const store = useRunsStore();
  return useSyncExternalStore(store.subscribeTime, store.getTimeSnapshot, store.getTimeSnapshot);
}

/** Hook to register a surface's commit handlers. Re-registers when handlers change. */
export function useSurfaceHandler(surfaceId: string, handler: SurfaceHandler) {
  const store = useRunsStore();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    store.registerSurface(surfaceId, {
      onChunk: (req, runId, full) => ref.current.onChunk(req, runId, full),
      onFinish: (req, runId, full, status) => ref.current.onFinish(req, runId, full, status),
      onJumpTo: (req, runId) => ref.current.onJumpTo?.(req, runId),
    });
    return () => store.unregisterSurface(surfaceId);
  }, [surfaceId, store]);
}

/** Hook that gives back: queue for a surface, isRunning for a surface, paused flag. */
export function useSurfaceQueue(surfaceId: string) {
  const state = useRunsState();
  return useMemo(() => {
    const queue = state.queues.get(surfaceId) ?? [];
    const activeRuns = Array.from(state.activeRuns.values()).filter(
      (r) => r.surfaceId === surfaceId,
    );
    const isRunning = activeRuns.length > 0;
    const paused = state.paused.has(surfaceId);
    return { queue, activeRuns, isRunning, paused };
  }, [state, surfaceId]);
}

// ============================================================
// First-time-tip onboarding state (in-memory, dismissed once mounted)
// ============================================================

// Module-level flags — survive component remounts within a single session.
// Sandbox forbids localStorage; this is good enough for the prototype.
let __activityTipDismissed = false;
let __queueTipDismissed = false;

export function useOnboardingTip(): [boolean, () => void] {
  const [dismissed, setDismissed] = useState<boolean>(__activityTipDismissed);
  const dismiss = () => {
    __activityTipDismissed = true;
    setDismissed(true);
  };
  return [!dismissed, dismiss];
}

export function useQueueTip(): [boolean, () => void] {
  const [dismissed, setDismissed] = useState<boolean>(__queueTipDismissed);
  const dismiss = () => {
    __queueTipDismissed = true;
    setDismissed(true);
  };
  return [!dismissed, dismiss];
}
