/**
 * ActivityDock — persistent bottom strip showing every active and queued run.
 *
 * States:
 *  - Hidden: no runs anywhere → just a 4px clickable line (also dismisses on its own).
 *  - Collapsed: a 44px strip with counter on the left + condensed run list scrolling horizontally.
 *  - Expanded: full panel up to 50vh, all runs visible, controls revealed.
 *
 * Pinned at the bottom of the viewport via fixed positioning. The AppShell adds
 * dynamic bottom padding so the dock never covers important content.
 */

import { useMemo, useState, useEffect, useRef } from "react";
import {
  ChevronUp,
  ChevronDown,
  X,
  ArrowUpRight,
  MoreHorizontal,
  GitBranch,
  RotateCcw,
  Sparkles,
  Pause,
  Play,
  Clock,
} from "lucide-react";
import {
  useRunsState,
  useRunsStore,
  useRunsTimeTick,
  useOnboardingTip,
  type RunMeta,
} from "@/lib/runs-store";
import { modelById, providerClass, MODELS } from "@/lib/models";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export type DockState = "hidden" | "collapsed" | "expanded";

export function useDockState(): {
  state: DockState;
  setState: (s: DockState) => void;
  reservedHeight: number;
} {
  // Persist collapse/expand preference across navigation (in-memory only; sandbox blocks storage).
  const [userState, setUserState] = useState<"collapsed" | "expanded">(
    () => (typeof window !== "undefined" && (window as any).__conductorDockState) || "collapsed",
  );
  const runs = useRunsState();
  const hasAnything =
    runs.activeRuns.size > 0 ||
    Array.from(runs.queues.values()).some((q) => q.length > 0);
  const state: DockState = hasAnything ? userState : "hidden";

  const setState = (next: DockState) => {
    if (next === "hidden") return; // not user-controllable
    setUserState(next);
    if (typeof window !== "undefined") {
      (window as any).__conductorDockState = next;
    }
  };

  const reservedHeight = state === "hidden" ? 4 : state === "collapsed" ? 48 : 0;
  // Expanded handled by the dock itself overlaying without reserving
  return { state, setState, reservedHeight };
}

interface ActivityDockProps {
  onRetry?: (run: RunMeta, newModelId: string) => void;
  onBranch?: (run: RunMeta) => void;
}

export function ActivityDock({ onRetry, onBranch }: ActivityDockProps) {
  const runs = useRunsState();
  const { state, setState } = useDockState();
  const [showTip, dismissTip] = useOnboardingTip();

  const activeRuns = useMemo(
    () => Array.from(runs.activeRuns.values()).sort((a, b) => a.startedAt - b.startedAt),
    [runs.activeRuns],
  );
  const queuedFlat = useMemo(() => {
    const list: { surfaceId: string; req: any; index: number }[] = [];
    for (const [surfaceId, queue] of runs.queues.entries()) {
      queue.forEach((req, index) => list.push({ surfaceId, req, index }));
    }
    return list;
  }, [runs.queues]);

  if (state === "hidden") {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 h-1 bg-border/60 cursor-pointer hover:bg-primary/40 transition-colors z-40"
        onClick={() => setState("collapsed")}
        title="Activity dock"
        data-testid="dock-handle-hidden"
      />
    );
  }

  if (state === "collapsed") {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 h-12 border-t border-border bg-card/95 backdrop-blur-md z-40 flex items-center gap-3 px-3 min-w-0"
        data-testid="dock-collapsed"
      >
        <button
          onClick={() => setState("expanded")}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover-elevate shrink-0"
          data-testid="button-expand-dock"
        >
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {activeRuns.length} running · {queuedFlat.length} queued
          </span>
        </button>

        <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar flex items-center gap-2">
          {activeRuns.length === 0 && queuedFlat.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">No runs.</span>
          ) : (
            <>
              {activeRuns.map((r) => (
                <CompactRow key={r.id} run={r} />
              ))}
              {queuedFlat.slice(0, 6).map(({ surfaceId, req, index }) => (
                <CompactQueuedRow
                  key={`${surfaceId}-${index}-${req.queueId ?? index}`}
                  surfaceId={surfaceId}
                  req={req}
                />
              ))}
            </>
          )}
        </div>

        {showTip && (
          <div className="hidden md:flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] text-foreground/85">
            <Sparkles className="w-3 h-3 text-primary shrink-0" />
            <span>
              Tip: submit a prompt, then keep going. Streams continue in the background.
            </span>
            <button
              onClick={dismissTip}
              className="ml-1 p-0.5 rounded hover-elevate text-muted-foreground"
              aria-label="Dismiss tip"
              data-testid="button-dismiss-tip"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Expanded
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-popover/95 backdrop-blur-md flex flex-col"
      style={{ maxHeight: "50vh" }}
      data-testid="dock-expanded"
    >
      <div className="h-12 border-b border-border flex items-center gap-3 px-3 shrink-0">
        <button
          onClick={() => setState("collapsed")}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover-elevate"
          data-testid="button-collapse-dock"
        >
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Activity
          </span>
        </button>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {activeRuns.length} running · {queuedFlat.length} queued
        </span>
        <div className="flex-1" />
        {showTip && (
          <div className="hidden md:flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] text-foreground/85">
            <Sparkles className="w-3 h-3 text-primary shrink-0" />
            <span>
              Tip: submit a prompt, then keep going. Streams continue in the background.
            </span>
            <button
              onClick={dismissTip}
              className="ml-1 p-0.5 rounded hover-elevate text-muted-foreground"
              aria-label="Dismiss tip"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto nice-scroll">
        {activeRuns.length === 0 && queuedFlat.length === 0 && (
          <div className="px-4 py-10 text-center text-muted-foreground text-xs">
            No active or queued runs.
          </div>
        )}
        {activeRuns.length > 0 && (
          <div>
            <div className="px-3 pt-3 pb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Running
            </div>
            <div>
              {activeRuns.map((r) => (
                <RunRow key={r.id} run={r} onRetry={onRetry} onBranch={onBranch} />
              ))}
            </div>
          </div>
        )}
        {queuedFlat.length > 0 && (
          <div>
            <div className="px-3 pt-3 pb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Queued
            </div>
            <div>
              {queuedFlat.map(({ surfaceId, req, index }) => (
                <QueuedRow
                  key={`${surfaceId}-${index}-${req.queueId ?? index}`}
                  surfaceId={surfaceId}
                  req={req}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Rows
// ============================================================

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function CompactRow({ run }: { run: RunMeta }) {
  useRunsTimeTick(); // re-render once a second
  const model = modelById(run.modelId);
  const elapsed = formatElapsed(Date.now() - run.startedAt);
  const store = useRunsStore();
  return (
    <div
      className={`${providerClass(
        model.provider,
      )} inline-flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1 shrink-0`}
      data-testid={`compact-run-${run.id}`}
    >
      <span className="w-1.5 h-1.5 rounded-full provider-dot animate-pulse" />
      <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/90">
        {model.name}
      </span>
      <span className="text-[10px] text-muted-foreground/70 truncate max-w-[120px]">
        {run.paneLabel}
      </span>
      <span className="font-mono text-[10px] text-muted-foreground">{elapsed}</span>
      <button
        onClick={() => store.cancel(run.id)}
        className="p-0.5 rounded hover-elevate text-muted-foreground"
        aria-label="Cancel"
        data-testid={`button-cancel-compact-${run.id}`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function CompactQueuedRow({ surfaceId, req }: { surfaceId: string; req: any }) {
  const model = modelById(req.modelId);
  const store = useRunsStore();
  return (
    <div
      className={`${providerClass(
        model.provider,
      )} inline-flex items-center gap-2 rounded-md border border-dashed border-border/60 bg-background/20 px-2 py-1 shrink-0 opacity-70`}
    >
      <Clock className="w-3 h-3 text-muted-foreground" />
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {model.name}
      </span>
      <span className="text-[10px] text-muted-foreground/70 truncate max-w-[120px]">
        {req.paneLabel}
      </span>
      <button
        onClick={() => store.cancelQueued(surfaceId, req.queueId)}
        className="p-0.5 rounded hover-elevate text-muted-foreground"
        aria-label="Remove from queue"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function RunRow({
  run,
  onRetry,
  onBranch,
}: {
  run: RunMeta;
  onRetry?: (run: RunMeta, modelId: string) => void;
  onBranch?: (run: RunMeta) => void;
}) {
  useRunsTimeTick();
  const model = modelById(run.modelId);
  const store = useRunsStore();
  const elapsed = formatElapsed(Date.now() - run.startedAt);

  return (
    <div
      className={`${providerClass(
        model.provider,
      )} border-b border-border/40 px-3 py-2.5 flex items-center gap-3 hover:bg-muted/30 group`}
      data-testid={`run-row-${run.id}`}
    >
      <span className="w-2 h-2 rounded-full provider-dot animate-pulse shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-foreground/95 truncate">{model.name}</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
            {run.paneLabel}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground/80 truncate">
          {run.promptPreview}
        </div>
        <div className="mt-1.5 h-0.5 bg-border/60 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-primary/80 to-transparent shimmer" />
        </div>
      </div>
      <span className="font-mono text-[11px] text-muted-foreground shrink-0">{elapsed}</span>
      <button
        onClick={() => store.jumpTo(run.id)}
        className="p-1.5 rounded-md hover-elevate text-muted-foreground"
        aria-label="Jump to pane"
        data-testid={`button-jump-${run.id}`}
      >
        <ArrowUpRight className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => store.cancel(run.id)}
        className="p-1.5 rounded-md hover-elevate text-muted-foreground hover:text-destructive"
        aria-label="Cancel"
        data-testid={`button-cancel-${run.id}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1.5 rounded-md hover-elevate text-muted-foreground"
            aria-label="More"
            data-testid={`button-more-${run.id}`}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => onBranch?.(run)}
            className="text-xs cursor-pointer"
            data-testid={`menu-branch-${run.id}`}
          >
            <GitBranch className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
            Branch this thread
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Retry with…
          </DropdownMenuLabel>
          {MODELS.filter((m) => m.id !== run.modelId)
            .slice(0, 6)
            .map((m) => (
              <DropdownMenuItem
                key={m.id}
                onClick={() => onRetry?.(run, m.id)}
                className="text-xs cursor-pointer flex items-center gap-2"
                data-testid={`menu-retry-${run.id}-${m.id}`}
              >
                <RotateCcw className="w-3 h-3 text-muted-foreground" />
                <span className={`${providerClass(m.provider)} w-1.5 h-1.5 rounded-full provider-dot`} />
                <span>{m.name}</span>
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function QueuedRow({ surfaceId, req }: { surfaceId: string; req: any }) {
  const model = modelById(req.modelId);
  const store = useRunsStore();
  return (
    <div
      className={`${providerClass(
        model.provider,
      )} border-b border-border/40 px-3 py-2 flex items-center gap-3 opacity-70 hover:opacity-100`}
    >
      <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-foreground/85 truncate">{model.name}</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
            {req.paneLabel}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground/80 truncate">{req.promptPreview}</div>
      </div>
      <button
        onClick={() => store.cancelQueued(surfaceId, req.queueId)}
        className="p-1.5 rounded-md hover-elevate text-muted-foreground"
        aria-label="Remove"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ============================================================
// Per-surface helpers used by surfaces
// ============================================================

/** A small chip showing "Q:n" if queue > 0 — meant for surface headers */
export function QueueChip({ surfaceId, color = "bg-primary text-primary-foreground" }: {
  surfaceId: string;
  color?: string;
}) {
  const runs = useRunsState();
  const queue = runs.queues.get(surfaceId) ?? [];
  if (queue.length === 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${color}`}
      title={`${queue.length} queued`}
      data-testid={`queue-chip-${surfaceId}`}
    >
      Q:{queue.length}
    </span>
  );
}

/** The expandable queue list, opened by clicking "n queued" badge under composer */
export function QueuePopover({
  surfaceId,
  paused,
  onTogglePause,
}: {
  surfaceId: string;
  paused?: boolean;
  onTogglePause?: () => void;
}) {
  const runs = useRunsState();
  const store = useRunsStore();
  const queue = runs.queues.get(surfaceId) ?? [];
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const dragRef = useRef<number | null>(null);

  if (queue.length === 0 && !paused) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary hover-elevate"
        data-testid={`button-queue-popover-${surfaceId}`}
      >
        <Clock className="w-2.5 h-2.5" />
        {queue.length} queued
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex-1">
              Queue · {queue.length}
            </span>
            {onTogglePause && (
              <button
                onClick={onTogglePause}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] hover-elevate"
                data-testid={`button-pause-queue-${surfaceId}`}
              >
                {paused ? (
                  <>
                    <Play className="w-2.5 h-2.5" /> Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-2.5 h-2.5" /> Pause
                  </>
                )}
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto nice-scroll">
            {queue.map((req: any, idx) => {
              const model = modelById(req.modelId);
              const editing = editingId === req.queueId;
              return (
                <div
                  key={req.queueId}
                  draggable={!editing}
                  onDragStart={() => (dragRef.current = idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragRef.current != null && dragRef.current !== idx) {
                      store.reorderQueued(surfaceId, dragRef.current, idx);
                    }
                    dragRef.current = null;
                  }}
                  className={`${providerClass(
                    model.provider,
                  )} border-b border-border/40 px-3 py-2 hover:bg-muted/40`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full provider-dot" />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {model.name}
                    </span>
                    <div className="flex-1" />
                    <button
                      onClick={() => {
                        if (editing) {
                          setEditingId(null);
                        } else {
                          setEditingId(req.queueId);
                          setEditText(req.promptPreview);
                        }
                      }}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      {editing ? "Done" : "Edit"}
                    </button>
                    <button
                      onClick={() => store.cancelQueued(surfaceId, req.queueId)}
                      className="p-0.5 rounded hover-elevate text-muted-foreground hover:text-destructive"
                      aria-label="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {editing ? (
                    <input
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={() => {
                        const t = editText.trim();
                        if (t) {
                          const newMessages = [...(req.messages ?? [])];
                          // assume the LAST user message is the prompt; replace its content
                          for (let i = newMessages.length - 1; i >= 0; i--) {
                            if (newMessages[i].role === "user") {
                              newMessages[i] = { ...newMessages[i], content: t };
                              break;
                            }
                          }
                          store.editQueued(surfaceId, req.queueId, t, newMessages);
                        }
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="w-full bg-transparent text-[11px] focus:outline-none border-b border-border/60"
                    />
                  ) : (
                    <div className="text-[11px] text-foreground/80 line-clamp-2">
                      {req.promptPreview}
                    </div>
                  )}
                </div>
              );
            })}
            {queue.length === 0 && (
              <div className="px-3 py-4 text-[11px] text-muted-foreground text-center">
                Queue is empty.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Shimmer animation
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    // no-op
  }
}

// Inject shimmer style once
if (typeof document !== "undefined" && !document.getElementById("dock-shimmer-style")) {
  const style = document.createElement("style");
  style.id = "dock-shimmer-style";
  style.textContent = `
    @keyframes dock-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
    .shimmer { animation: dock-shimmer 1.8s linear infinite; }
  `;
  document.head.appendChild(style);
}

// Provide an effect-only mount marker to suppress unused-import warnings
void useEffect;
