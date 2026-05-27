import { useState, useEffect, useRef } from "react";
import { Plus, X, Play, Sparkles, GitBranch, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { ModelPicker } from "./ModelPicker";
import { ModelBadge } from "./ModelBadge";
import { MODELS, modelById, providerClass } from "@/lib/models";
import { type ChatMessage } from "@/lib/ai-gateway";
import { mockSynthesis } from "@/lib/mock-responses";
import { useRunsStore, useSurfaceHandler, useSurfaceQueue } from "@/lib/runs-store";
import { QueueChip, QueuePopover } from "./ActivityDock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Variant {
  id: string;
  modelId: string;
  output: string;
  streaming: boolean;
  done: boolean;
  stopped?: boolean;
}

interface Column {
  id: string;
  modelId: string;
  variants: Variant[]; // first one is the original, rest are retries
  activeIdx: number;
}

const DEFAULT_MODELS = ["gpt-5", "claude-opus-4", "gemini-2.5-pro"];

function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function CompareMode() {
  const [prompt, setPrompt] = useState("");
  const [columns, setColumns] = useState<Column[]>(() =>
    DEFAULT_MODELS.map((id, i) => ({
      id: `c${i}`,
      modelId: id,
      variants: [{ id: uid("v"), modelId: id, output: "", streaming: false, done: false }],
      activeIdx: 0,
    })),
  );
  const store = useRunsStore();
  const promptRef = useRef(prompt);
  promptRef.current = prompt;

  // Register a single surface handler per column (we use column.id as surfaceId)
  // Use an effect-driven approach: re-register whenever the columns change

  return (
    <div className="h-full flex flex-col">
      {/* Prompt bar */}
      <div className="px-6 py-4 border-b border-border">
        <div className="rounded-xl border border-border bg-card flex items-end gap-2 p-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleRun();
              }
            }}
            placeholder="One prompt. Multiple models. Run them in parallel."
            rows={2}
            className="flex-1 bg-transparent px-3 py-2 text-sm resize-none focus:outline-none placeholder:text-muted-foreground"
            data-testid="input-compare"
          />
          <button
            onClick={handleRun}
            disabled={!prompt.trim()}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover-elevate-2 disabled:opacity-40"
            data-testid="button-run-compare"
          >
            <Play className="w-3.5 h-3.5" />
            Run
          </button>
        </div>
        <div className="mt-2 px-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
          {columns.length} models \u00b7 responses stream in parallel \u00b7 each column has its own queue
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden nice-scroll">
        <div className="h-full flex gap-3 px-6 py-4 min-w-fit">
          {columns.map((col) => (
            <ColumnCard
              key={col.id}
              col={col}
              onUpdate={(patch) =>
                setColumns((cs) => cs.map((c) => (c.id === col.id ? { ...c, ...patch } : c)))
              }
              onRemove={() =>
                setColumns((cs) => (cs.length > 2 ? cs.filter((c) => c.id !== col.id) : cs))
              }
              onSetVariant={(idx) =>
                setColumns((cs) => cs.map((c) => (c.id === col.id ? { ...c, activeIdx: idx } : c)))
              }
              onAddVariant={(variant) =>
                setColumns((cs) =>
                  cs.map((c) =>
                    c.id === col.id
                      ? { ...c, variants: [...c.variants, variant], activeIdx: c.variants.length }
                      : c,
                  ),
                )
              }
              onUpdateVariant={(vId, patch) =>
                setColumns((cs) =>
                  cs.map((c) =>
                    c.id === col.id
                      ? {
                          ...c,
                          variants: c.variants.map((v) => (v.id === vId ? { ...v, ...patch } : v)),
                        }
                      : c,
                  ),
                )
              }
              canRemove={columns.length > 2}
              onBranchColumn={() => {
                // Duplicate the column at the current variant
                const v = col.variants[col.activeIdx];
                if (!v) return;
                const newCol: Column = {
                  id: `c-${uid()}`,
                  modelId: v.modelId,
                  variants: [{ id: uid("v"), modelId: v.modelId, output: v.output, streaming: false, done: true }],
                  activeIdx: 0,
                };
                setColumns((cs) => [...cs, newCol]);
              }}
              promptRef={promptRef}
              colSize={columns.length}
            />
          ))}

          {columns.length < 4 && (
            <button
              onClick={addColumn}
              className="w-[340px] shrink-0 h-full rounded-lg border border-dashed border-border hover:border-foreground/30 text-muted-foreground hover:text-foreground flex flex-col items-center justify-center gap-2 transition-colors"
              data-testid="button-add-column"
            >
              <Plus className="w-5 h-5" />
              <span className="text-xs font-mono uppercase tracking-wider">Add model</span>
            </button>
          )}
        </div>
      </div>

      {/* Synthesis */}
      <SynthesisBar columns={columns} prompt={prompt} />
    </div>
  );

  function addColumn() {
    if (columns.length >= 4) return;
    const unused = MODELS.find((m) => !columns.find((c) => c.modelId === m.id));
    if (!unused) return;
    setColumns((cs) => [
      ...cs,
      {
        id: `c${Date.now()}`,
        modelId: unused.id,
        variants: [{ id: uid("v"), modelId: unused.id, output: "", streaming: false, done: false }],
        activeIdx: 0,
      },
    ]);
  }

  function handleRun() {
    if (!prompt.trim()) return;
    // Reset each column's primary variant + kick off a run via runs-store
    const history: ChatMessage[] = [{ role: "user", content: prompt }];
    setColumns((cs) =>
      cs.map((c) => {
        const newPrimary: Variant = { id: uid("v"), modelId: c.modelId, output: "", streaming: true, done: false };
        return { ...c, variants: [newPrimary, ...c.variants.slice(1)], activeIdx: 0 };
      }),
    );
    // Submit on next frame so the columns state has settled
    queueMicrotask(() => {
      setColumns((cs) => {
        for (const c of cs) {
          const v = c.variants[0];
          if (!v) continue;
          const req: any = {
            surfaceId: c.id,
            surfaceKind: "compare",
            paneLabel: `Compare \u00b7 ${modelById(c.modelId).name}`,
            modelId: c.modelId,
            messages: history,
            promptPreview: prompt,
            onMeta: { messageId: v.id },
            variantId: v.id,
            columnId: c.id,
          };
          store.submit(req);
        }
        return cs;
      });
    });
  }
}

function ColumnCard({
  col,
  onUpdate,
  onRemove,
  onSetVariant,
  onAddVariant,
  onUpdateVariant,
  canRemove,
  onBranchColumn,
  promptRef,
  colSize,
}: {
  col: Column;
  onUpdate: (patch: Partial<Column>) => void;
  onRemove: () => void;
  onSetVariant: (idx: number) => void;
  onAddVariant: (v: Variant) => void;
  onUpdateVariant: (vId: string, patch: Partial<Variant>) => void;
  canRemove: boolean;
  onBranchColumn: () => void;
  promptRef: { current: string };
  colSize: number;
}) {
  const model = modelById(col.modelId);
  const active = col.variants[col.activeIdx] ?? col.variants[0];
  const store = useRunsStore();
  const surface = useSurfaceQueue(col.id);

  useSurfaceHandler(col.id, {
    onChunk: (req, _runId, full) => {
      const vId = (req as any).variantId;
      if (!vId) return;
      onUpdateVariant(vId, { output: full });
    },
    onFinish: (req, _runId, finalText, status) => {
      const vId = (req as any).variantId;
      if (!vId) return;
      onUpdateVariant(vId, {
        output: finalText,
        streaming: false,
        done: status === "done",
        stopped: status === "stopped",
      });
    },
  });

  const retryVariant = (modelId: string) => {
    const vId = uid("v");
    onAddVariant({ id: vId, modelId, output: "", streaming: true, done: false });
    const history: ChatMessage[] = [{ role: "user", content: promptRef.current }];
    const req: any = {
      surfaceId: col.id,
      surfaceKind: "compare",
      paneLabel: `Compare \u00b7 retry`,
      modelId,
      messages: history,
      promptPreview: promptRef.current,
      onMeta: { messageId: vId },
      variantId: vId,
    };
    store.submit(req);
  };

  const cancelActive = () => {
    for (const r of surface.activeRuns) store.cancel(r.id);
  };

  return (
    <div
      className={`${providerClass(model.provider)} w-[340px] shrink-0 h-full flex flex-col rounded-lg border border-border bg-card overflow-hidden ${
        active?.streaming ? "provider-glow" : ""
      }`}
    >
      <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
        <ModelPicker
          value={col.modelId}
          onChange={(id) => onUpdate({ modelId: id })}
          compact
        />
        <QueueChip surfaceId={col.id} color="bg-primary/20 text-primary border border-primary/40" />
        <div className="flex-1" />
        {active?.streaming && (
          <span className="text-[10px] font-mono uppercase tracking-wider provider-text">live</span>
        )}
        {col.variants.length > 1 && (
          <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card px-1 py-0.5">
            <button
              onClick={() => onSetVariant(Math.max(0, col.activeIdx - 1))}
              disabled={col.activeIdx <= 0}
              className="p-0.5 rounded hover-elevate text-muted-foreground disabled:opacity-30"
              aria-label="Prev variant"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="font-mono text-[10px] text-muted-foreground px-1">
              {col.activeIdx + 1}/{col.variants.length}
            </span>
            <button
              onClick={() => onSetVariant(Math.min(col.variants.length - 1, col.activeIdx + 1))}
              disabled={col.activeIdx >= col.variants.length - 1}
              className="p-0.5 rounded hover-elevate text-muted-foreground disabled:opacity-30"
              aria-label="Next variant"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
        <button
          onClick={onBranchColumn}
          className="p-1 rounded hover-elevate text-muted-foreground"
          aria-label="Branch column"
          title="Branch this column"
          data-testid={`button-branch-col-${col.id}`}
        >
          <GitBranch className="w-3 h-3" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 rounded hover-elevate text-muted-foreground"
              aria-label="Retry with different model"
              data-testid={`button-retry-col-${col.id}`}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Retry with
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {MODELS.filter((m) => m.id !== col.modelId).map((m) => (
              <DropdownMenuItem
                key={m.id}
                onClick={() => retryVariant(m.id)}
                className="text-xs cursor-pointer flex items-center gap-2"
              >
                <span className={`${providerClass(m.provider)} w-1.5 h-1.5 rounded-full provider-dot`} />
                <span>{m.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {active?.streaming && (
          <button
            onClick={cancelActive}
            className="p-1 rounded hover-elevate text-muted-foreground hover:text-destructive"
            aria-label="Cancel"
            data-testid={`button-cancel-col-${col.id}`}
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {canRemove && colSize > 2 && (
          <button
            onClick={onRemove}
            className="p-1 rounded hover-elevate text-muted-foreground"
            aria-label="Remove column"
            data-testid={`button-remove-column-${col.id}`}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap nice-scroll">
        {active?.output ? (
          <>
            <span className={active.streaming ? "stream-cursor" : ""}>{active.output}</span>
            {active.stopped && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-destructive">
                Stopped
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground/60 text-xs font-mono uppercase tracking-wider">
            {active?.streaming ? "Streaming\u2026" : "Awaiting prompt"}
          </div>
        )}
      </div>
      <div className="px-3 py-2 border-t border-border/60 flex items-center gap-2 min-h-[36px]">
        <QueuePopover
          surfaceId={col.id}
          paused={surface.paused}
          onTogglePause={() => store.setPaused(col.id, !surface.paused)}
        />
        <div className="flex-1" />
        <button
          onClick={() => {
            const p = promptRef.current.trim();
            if (!p) return;
            const vId = uid("v");
            onAddVariant({ id: vId, modelId: col.modelId, output: "", streaming: true, done: false });
            const req: any = {
              surfaceId: col.id,
              surfaceKind: "compare",
              paneLabel: `Compare \u00b7 ${modelById(col.modelId).name}`,
              modelId: col.modelId,
              messages: [{ role: "user", content: p }],
              promptPreview: p,
              onMeta: { messageId: vId },
              variantId: vId,
            };
            store.submit(req);
          }}
          className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground rounded-md px-1.5 py-0.5 hover-elevate"
        >
          + Run this column
        </button>
      </div>
    </div>
  );
}

function SynthesisBar({ columns, prompt }: { columns: Column[]; prompt: string }) {
  const [synth, setSynth] = useState<{ id: string; modelId: string; output: string; streaming: boolean } | null>(null);
  const [synthModel, setSynthModel] = useState("claude-opus-4");
  const store = useRunsStore();
  const synthSurfaceId = "compare-synthesis";

  useSurfaceHandler(synthSurfaceId, {
    onChunk: (_req, _runId, full) => {
      setSynth((s) => (s ? { ...s, output: full } : null));
    },
    onFinish: (_req, _runId, finalText, status) => {
      setSynth((s) => (s ? { ...s, output: finalText, streaming: status === "done" } : null));
      setSynth((s) => (s ? { ...s, streaming: false } : null));
    },
  });

  const allDone = columns.every((c) => {
    const v = c.variants[c.activeIdx];
    return v && (v.done || v.stopped);
  });
  if (!allDone) return null;

  const handleSynth = () => {
    const id = uid("s");
    setSynth({ id, modelId: synthModel, output: "", streaming: true });
    store.submit({
      surfaceId: synthSurfaceId,
      surfaceKind: "compare",
      paneLabel: "Compare \u00b7 synthesis",
      modelId: synthModel,
      messages: [{ role: "user", content: prompt }],
      promptPreview: "Synthesize the column outputs",
      onMeta: { messageId: id },
      gatewayOptions: { responseOverride: mockSynthesis(), chunkDelay: 30 },
    });
  };

  return (
    <div className="border-t border-border bg-sidebar/40 px-6 py-4 animate-fade-in">
      {!synth ? (
        <div className="max-w-3xl flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <div className="text-sm">
            <span className="font-medium">Ready to synthesize.</span>{" "}
            <span className="text-muted-foreground">Merge the best parts of each response into a final answer.</span>
          </div>
          <div className="flex-1" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Synthesizer</span>
          <ModelPicker value={synthModel} onChange={setSynthModel} compact />
          <button
            onClick={handleSynth}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover-elevate-2 disabled:opacity-40"
            data-testid="button-synthesize"
          >
            <Sparkles className="w-3 h-3" />
            Synthesize
          </button>
        </div>
      ) : (
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Synthesis</span>
            <ModelBadge model={modelById(synth.modelId)} size="xs" active={synth.streaming} />
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/95">
            <span className={synth.streaming ? "stream-cursor" : ""}>{synth.output}</span>
          </div>
        </div>
      )}
    </div>
  );
}
// Touch unused
void useEffect;
