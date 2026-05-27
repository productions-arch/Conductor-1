import { useEffect, useRef, useState } from "react";
import {
  Play,
  Plus,
  Trash2,
  Loader2,
  Check,
  GitBranch,
  Sparkles,
  X,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { ModelPicker } from "./ModelPicker";
import { modelById, providerClass, MODELS } from "@/lib/models";
import { WORKFLOW_OUTPUTS } from "@/lib/mock-responses";
import {
  useRunsStore,
  useRunsState,
  useSurfaceHandler,
  type RunRequest,
} from "@/lib/runs-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type NodeStatus = "idle" | "running" | "done" | "stopped";

interface WorkflowNode {
  id: string;
  modelId: string;
  label: string;
  prompt: string;
  /** Pre-written output for this step (workflow-specific) */
  outputOverride?: string;
  output: string;
  status: NodeStatus;
}

interface Template {
  id: string;
  name: string;
  description: string;
  build: (input: string) => WorkflowNode[];
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}

const TEMPLATES: Template[] = [
  {
    id: "draft-critique-refine",
    name: "Draft → Critique → Refine",
    description: "Claude drafts, GPT-5 critiques, Claude refines based on critique",
    build: (input) => [
      {
        id: uid("n"),
        modelId: "claude-opus-4",
        label: "Draft",
        prompt: "Write a first draft on this topic",
        outputOverride: WORKFLOW_OUTPUTS.draftCritiqueRefine.draft(input),
        output: "",
        status: "idle",
      },
      {
        id: uid("n"),
        modelId: "gpt-5",
        label: "Critique",
        prompt: "Critique the draft, naming strengths, weaknesses, and what to change",
        outputOverride: WORKFLOW_OUTPUTS.draftCritiqueRefine.critique(),
        output: "",
        status: "idle",
      },
      {
        id: uid("n"),
        modelId: "claude-opus-4",
        label: "Refine",
        prompt: "Rewrite the draft, addressing the critique",
        outputOverride: WORKFLOW_OUTPUTS.draftCritiqueRefine.refine(),
        output: "",
        status: "idle",
      },
    ],
  },
  {
    id: "research-analyze-summarize",
    name: "Research → Analyze → Summarize",
    description: "Gemini researches, GPT-5 analyzes, Claude summarizes",
    build: (input) => [
      {
        id: uid("n"),
        modelId: "gemini-2.5-pro",
        label: "Research",
        prompt: "Gather primary sources and convergent findings",
        outputOverride: WORKFLOW_OUTPUTS.researchAnalyzeSummarize.research(input),
        output: "",
        status: "idle",
      },
      {
        id: uid("n"),
        modelId: "gpt-5",
        label: "Analyze",
        prompt: "Find structural surprises in the research",
        outputOverride: WORKFLOW_OUTPUTS.researchAnalyzeSummarize.analyze(),
        output: "",
        status: "idle",
      },
      {
        id: uid("n"),
        modelId: "claude-sonnet-4",
        label: "Summarize",
        prompt: "Tight executive summary with implications",
        outputOverride: WORKFLOW_OUTPUTS.researchAnalyzeSummarize.summarize(),
        output: "",
        status: "idle",
      },
    ],
  },
  {
    id: "debate",
    name: "Debate",
    description: "Two models argue opposite sides, a third judges",
    build: (input) => [
      {
        id: uid("n"),
        modelId: "claude-opus-4",
        label: "Argue for",
        prompt: "Make the strongest case for the position",
        outputOverride: WORKFLOW_OUTPUTS.debate.pro(input),
        output: "",
        status: "idle",
      },
      {
        id: uid("n"),
        modelId: "gpt-5",
        label: "Argue against",
        prompt: "Make the strongest case against",
        outputOverride: WORKFLOW_OUTPUTS.debate.con(),
        output: "",
        status: "idle",
      },
      {
        id: uid("n"),
        modelId: "gemini-2.5-pro",
        label: "Judge",
        prompt: "Weigh the arguments and render a verdict",
        outputOverride: WORKFLOW_OUTPUTS.debate.judge(),
        output: "",
        status: "idle",
      },
    ],
  },
  {
    id: "translate-chain",
    name: "Translate Chain",
    description: "Pass through three languages and back — see what survives",
    build: () => [
      {
        id: uid("n"),
        modelId: "gpt-4o",
        label: "→ Spanish",
        prompt: "Translate to Spanish",
        outputOverride: WORKFLOW_OUTPUTS.translate.spanish(""),
        output: "",
        status: "idle",
      },
      {
        id: uid("n"),
        modelId: "gemini-2.5-pro",
        label: "→ Japanese",
        prompt: "Translate the Spanish to Japanese",
        outputOverride: WORKFLOW_OUTPUTS.translate.japanese(),
        output: "",
        status: "idle",
      },
      {
        id: uid("n"),
        modelId: "claude-opus-4",
        label: "→ Arabic",
        prompt: "Translate the Japanese to Arabic",
        outputOverride: WORKFLOW_OUTPUTS.translate.arabic(),
        output: "",
        status: "idle",
      },
      {
        id: uid("n"),
        modelId: "gpt-5",
        label: "→ English",
        prompt: "Translate the Arabic back to English",
        outputOverride: WORKFLOW_OUTPUTS.translate.back(),
        output: "",
        status: "idle",
      },
    ],
  },
];

const SURFACE_PREFIX = "orchestrate-node-";

export function OrchestrateMode() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("draft-critique-refine");
  const [input, setInput] = useState("");
  const [nodes, setNodes] = useState<WorkflowNode[]>(() => TEMPLATES[0].build(""));
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const runsStore = useRunsStore();
  const runsState = useRunsState();

  // We use one surface per node (so cancel/queue is per-node) but actually
  // run sequentially via an async chain that awaits each node's run end.
  // For each node we register a surface handler that updates the node's text.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Map of node id -> resolve-fn for the currently in-flight promise
  const pendingResolvers = useRef<Map<string, (status: "done" | "stopped") => void>>(new Map());

  // Surface handlers: one per node id. We re-register every render so the
  // handlers close over the latest nodes/state.
  // Using individual hook calls for each node would violate rules-of-hooks;
  // instead we register imperatively via an effect.
  useEffect(() => {
    for (const node of nodes) {
      const surfaceId = `${SURFACE_PREFIX}${node.id}`;
      runsStore.registerSurface(surfaceId, {
        onChunk: (_req, _runId, full) => {
          setNodes((ns) =>
            ns.map((n) => (n.id === node.id ? { ...n, output: full } : n)),
          );
        },
        onFinish: (_req, _runId, finalText, status) => {
          setNodes((ns) =>
            ns.map((n) =>
              n.id === node.id
                ? {
                    ...n,
                    output: finalText,
                    status: status === "stopped" ? "stopped" : "done",
                  }
                : n,
            ),
          );
          const resolver = pendingResolvers.current.get(node.id);
          if (resolver) {
            pendingResolvers.current.delete(node.id);
            resolver(status === "stopped" ? "stopped" : "done");
          }
        },
      });
    }
    return () => {
      for (const node of nodes) {
        runsStore.unregisterSurface(`${SURFACE_PREFIX}${node.id}`);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.map((n) => n.id).join(",")]);

  const loadTemplate = (id: string) => {
    const t = TEMPLATES.find((tt) => tt.id === id);
    if (!t) return;
    setSelectedTemplate(id);
    setNodes(t.build(input));
    setHasRun(false);
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    const t = TEMPLATES.find((tt) => tt.id === selectedTemplate);
    if (t && !running && !hasRun) {
      setNodes(t.build(val));
    }
  };

  const setNodeModel = (id: string, modelId: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, modelId } : n)));
  };

  const addNode = () => {
    setNodes((ns) => [
      ...ns,
      {
        id: uid("n"),
        modelId: "gpt-5",
        label: `Step ${ns.length + 1}`,
        prompt: "Continue from the previous step",
        outputOverride:
          "Following from the prior step, the next move is to consolidate what survived: the core argument is intact, the supporting evidence is mostly portable, and the surface phrasing can be tightened without losing the substance.",
        output: "",
        status: "idle",
      },
    ]);
  };

  const removeNode = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
  };

  /** Submit one node and await its completion. Returns final status. */
  const runNode = (node: WorkflowNode): Promise<"done" | "stopped"> => {
    return new Promise<"done" | "stopped">((resolve) => {
      pendingResolvers.current.set(node.id, resolve);
      const surfaceId = `${SURFACE_PREFIX}${node.id}`;
      // Build conversation context including prior nodes' outputs
      const priorContext = nodesRef.current
        .slice(0, nodesRef.current.findIndex((n) => n.id === node.id))
        .map((n) => `${n.label}: ${n.output}`)
        .join("\n\n");
      const userText = priorContext
        ? `Original prompt: ${input}\n\n---\n${priorContext}\n\n---\n\nNow: ${node.prompt}`
        : input;
      const req: RunRequest = {
        surfaceId,
        surfaceKind: "orchestrate",
        paneLabel: `Orchestrate · ${node.label}`,
        modelId: node.modelId,
        messages: [{ role: "user", content: userText }],
        promptPreview: node.prompt,
        gatewayOptions: { responseOverride: node.outputOverride, chunkDelay: 14 },
      };
      setNodes((ns) =>
        ns.map((n) => (n.id === node.id ? { ...n, output: "", status: "running" } : n)),
      );
      runsStore.submit(req);
    });
  };

  const handleRun = async () => {
    if (!input.trim() || running) return;
    setRunning(true);
    setHasRun(true);
    setNodes((ns) =>
      ns.map((n) => ({ ...n, output: "", status: "idle" as NodeStatus })),
    );

    for (const node of nodesRef.current) {
      // Small pause so the user can see the node activate
      await new Promise((r) => setTimeout(r, 200));
      const status = await runNode(node);
      if (status === "stopped") {
        // Stop the chain if the user cancelled a node
        break;
      }
    }
    setRunning(false);
  };

  /** Cancel a specific node mid-stream */
  const cancelNode = (nodeId: string) => {
    const surfaceId = `${SURFACE_PREFIX}${nodeId}`;
    // Find active runs on that surface
    for (const m of runsState.activeRuns.values()) {
      if (m.surfaceId === surfaceId) {
        runsStore.cancel(m.id);
      }
    }
  };

  /** Retry a node with a (possibly different) model. Stops other in-flight nodes. */
  const retryNode = (nodeId: string, newModelId?: string) => {
    // Cancel any active run for this surface
    cancelNode(nodeId);
    setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId
          ? { ...n, output: "", status: "idle", modelId: newModelId ?? n.modelId }
          : n,
      ),
    );
    // Submit again
    setTimeout(() => {
      const fresh = nodesRef.current.find((n) => n.id === nodeId);
      if (fresh) {
        // Build a temporary node with override using updated model
        runNode({ ...fresh, modelId: newModelId ?? fresh.modelId });
      }
    }, 50);
  };

  const reset = () => {
    const t = TEMPLATES.find((tt) => tt.id === selectedTemplate);
    if (t) setNodes(t.build(input));
    setHasRun(false);
  };

  const finalNode = nodes[nodes.length - 1];

  return (
    <div className="h-full flex flex-col">
      {/* Template strip */}
      <div className="px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Templates
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => loadTemplate(t.id)}
              className={`shrink-0 text-left rounded-lg border px-3 py-2 transition-colors ${
                selectedTemplate === t.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover-elevate"
              }`}
              data-testid={`button-template-${t.id}`}
            >
              <div className="text-xs font-medium">{t.name}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[280px] truncate">
                {t.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto grid-bg nice-scroll min-h-0">
        <div className="p-8 min-h-full flex flex-col gap-6">
          {/* Input node */}
          <div className="self-center w-full max-w-2xl">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                Input
              </div>
              <textarea
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Enter the initial prompt for this workflow..."
                rows={2}
                className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted-foreground"
                data-testid="input-workflow"
              />
            </div>
          </div>

          <ArrowConnector />

          {/* Workflow nodes */}
          <div className="flex flex-col items-center gap-2">
            {nodes.map((node, idx) => (
              <div key={node.id} className="w-full max-w-2xl flex flex-col items-center gap-2">
                <WorkflowNodeCard
                  node={node}
                  index={idx + 1}
                  onModelChange={(id) => setNodeModel(node.id, id)}
                  onRemove={() => removeNode(node.id)}
                  canRemove={nodes.length > 1 && !running}
                  onCancel={() => cancelNode(node.id)}
                  onRetry={(newModelId) => retryNode(node.id, newModelId)}
                  canRetry={hasRun && !running && (node.status === "done" || node.status === "stopped")}
                />
                {idx < nodes.length - 1 && <ArrowConnector />}
              </div>
            ))}

            {!running && (
              <button
                onClick={addNode}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-3 py-1.5 hover-elevate"
                data-testid="button-add-node"
              >
                <Plus className="w-3 h-3" />
                Add step
              </button>
            )}
          </div>

          {/* Final output */}
          {finalNode?.status === "done" && (
            <>
              <ArrowConnector />
              <div className="self-center w-full max-w-2xl animate-fade-in">
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
                      Final output
                    </span>
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/95">
                    {finalNode.output}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Run bar */}
      <div className="border-t border-border px-6 py-3 flex items-center gap-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {nodes.length} {nodes.length === 1 ? "step" : "steps"}
        </div>
        <div className="flex-1" />
        {hasRun && !running && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover-elevate text-xs"
            data-testid="button-reset-workflow"
          >
            Reset
          </button>
        )}
        <button
          onClick={handleRun}
          disabled={!input.trim() || running}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover-elevate-2 disabled:opacity-40"
          data-testid="button-run-workflow"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {running ? "Running" : "Run workflow"}
        </button>
      </div>
    </div>
  );
}

function WorkflowNodeCard({
  node,
  index,
  onModelChange,
  onRemove,
  canRemove,
  onCancel,
  onRetry,
  canRetry,
}: {
  node: WorkflowNode;
  index: number;
  onModelChange: (id: string) => void;
  onRemove: () => void;
  canRemove: boolean;
  onCancel: () => void;
  onRetry: (newModelId?: string) => void;
  canRetry: boolean;
}) {
  const model = modelById(node.modelId);
  const status = node.status;

  return (
    <div
      className={`${providerClass(model.provider)} w-full rounded-lg border bg-card transition-all ${
        status === "running"
          ? "provider-border provider-glow scale-[1.01]"
          : status === "done"
          ? "border-border"
          : status === "stopped"
          ? "border-muted-foreground/30"
          : "border-border"
      }`}
    >
      <div className="px-4 py-2.5 flex items-center gap-3 border-b border-border/70">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground w-8">
          {String(index).padStart(2, "0")}
        </div>
        <div className="font-medium text-sm">{node.label}</div>
        <ModelPicker value={node.modelId} onChange={onModelChange} compact />
        <div className="flex-1" />
        <StatusPill status={status} />
        {status === "running" && (
          <button
            onClick={onCancel}
            className="p-1 rounded hover-elevate text-muted-foreground hover:text-destructive"
            aria-label="Cancel"
            data-testid={`button-cancel-node-${node.id}`}
            title="Cancel"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {canRetry && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 rounded hover-elevate text-muted-foreground inline-flex items-center gap-0.5"
                aria-label="Retry"
                data-testid={`button-retry-node-${node.id}`}
                title="Retry"
              >
                <RotateCcw className="w-3 h-3" />
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Retry with model
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onRetry()} className="text-xs cursor-pointer">
                Same model ({model.name})
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {MODELS.filter((m) => m.id !== node.modelId)
                .slice(0, 5)
                .map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => onRetry(m.id)}
                    className="text-xs cursor-pointer"
                  >
                    {m.name}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {canRemove && (
          <button
            onClick={onRemove}
            className="p-1 rounded hover-elevate text-muted-foreground"
            aria-label="Remove step"
            data-testid={`button-remove-node-${node.id}`}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="px-4 py-3">
        <div className="text-[11px] text-muted-foreground italic mb-2">{node.prompt}</div>
        {node.output ? (
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/95 max-h-64 overflow-y-auto nice-scroll">
            <span className={status === "running" ? "stream-cursor" : ""}>{node.output}</span>
          </div>
        ) : (
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/60">
            {status === "idle" ? "Waiting" : status === "stopped" ? "Stopped" : "Generating…"}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: NodeStatus }) {
  if (status === "running")
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider provider-text">
        <Loader2 className="w-3 h-3 animate-spin" />
        Running
      </span>
    );
  if (status === "done")
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-primary">
        <Check className="w-3 h-3" />
        Done
      </span>
    );
  if (status === "stopped")
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <X className="w-3 h-3" />
        Stopped
      </span>
    );
  return (
    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
      Idle
    </span>
  );
}

function ArrowConnector() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-px h-4 bg-border" />
      <div className="w-2 h-2 border-r border-b border-border rotate-45 -mt-1" />
    </div>
  );
}
