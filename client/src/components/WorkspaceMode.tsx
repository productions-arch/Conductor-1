import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  ArrowUp,
  Loader2,
  X,
  Plus,
  SplitSquareHorizontal,
  SplitSquareVertical,
  ChevronDown,
  Radio,
  GripVertical,
  Hash,
  LayoutGrid,
  RotateCcw,
  Sparkles,
  GitBranch,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { ModelPicker } from "./ModelPicker";
import { ModelBadge } from "./ModelBadge";
import { modelById, providerClass, MODELS } from "@/lib/models";
import { type ChatMessage as Msg } from "@/lib/ai-gateway";
import {
  useWorkspace,
  CHANNEL_COLORS,
  flattenLeaves,
  type LayoutNode,
  type SplitNode,
  type LeafNode,
  type PaneMessage,
  type Pane as PaneType,
  type PresetKey,
} from "@/lib/workspace-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  useRunsStore,
  useSurfaceHandler,
  useSurfaceQueue,
  type RunRequest,
} from "@/lib/runs-store";
import { QueuePopover } from "./ActivityDock";

// =====================================================================
// Workspace top-level
// =====================================================================
export function WorkspaceMode() {
  const ws = useWorkspace();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="h-full flex flex-col bg-background min-w-0">
      <WorkspaceToolbar />
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {isMobile ? <MobileStack /> : <PaneNode node={ws.layout} />}
      </div>
    </div>
  );
}

// =====================================================================
// Toolbar
// =====================================================================
function WorkspaceToolbar() {
  const { applyPreset, resetLayout, splitPane, activePaneId, panes } = useWorkspace();

  const addPane = () => {
    // Split the active pane horizontally
    if (activePaneId) splitPane(activePaneId, "horizontal");
  };

  return (
    <div className="h-11 border-b border-border bg-background flex items-center px-3 gap-2 shrink-0 min-w-0 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1 shrink-0">
        <ToolbarButton onClick={addPane} icon={<Plus className="w-3.5 h-3.5" />} label="New pane" testId="button-new-pane" />
        <ToolbarButton onClick={resetLayout} icon={<RotateCcw className="w-3.5 h-3.5" />} label="Reset" testId="button-reset-layout" />
        <PresetsMenu onPick={applyPreset} />
      </div>
      <div className="flex-1" />
      <div className="hidden md:flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <LayoutGrid className="w-3 h-3" />
        <span>{Object.keys(panes).length} panes</span>
        <span className="text-muted-foreground/40">·</span>
        <span>drag headers to swap</span>
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  icon,
  label,
  testId,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover-elevate"
      data-testid={testId}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function PresetsMenu({ onPick }: { onPick: (p: PresetKey) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover-elevate"
          data-testid="button-presets"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Layouts</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Layout presets
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <PresetItem onPick={onPick} value="single" label="Single pane" />
        <PresetItem onPick={onPick} value="2x1" label="2 columns" />
        <PresetItem onPick={onPick} value="1x2" label="2 rows" />
        <PresetItem onPick={onPick} value="2x2" label="2 × 2 grid" />
        <PresetItem onPick={onPick} value="3-column" label="3 columns" />
        <PresetItem onPick={onPick} value="editor-sidebar" label="Editor + sidebar" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PresetItem({
  value,
  label,
  onPick,
}: {
  value: PresetKey;
  label: string;
  onPick: (p: PresetKey) => void;
}) {
  return (
    <DropdownMenuItem onClick={() => onPick(value)} className="text-xs cursor-pointer" data-testid={`option-preset-${value}`}>
      {label}
    </DropdownMenuItem>
  );
}

// =====================================================================
// Recursive layout node
// =====================================================================
function PaneNode({ node }: { node: LayoutNode }) {
  if (node.type === "leaf") {
    return <LeafPane node={node} />;
  }
  return <SplitPane node={node} />;
}

function SplitPane({ node }: { node: SplitNode }) {
  const { setResizeRatio } = useWorkspace();
  const direction = node.direction; // "horizontal" = side-by-side (cols), "vertical" = stacked (rows)
  // react-resizable-panels' "horizontal" direction = horizontal layout (side by side)
  // "vertical" = vertical layout (stacked). Matches our model.

  const initialA = Math.round(node.ratio * 100);
  const initialB = 100 - initialA;

  const onLayout = useCallback(
    (sizes: number[]) => {
      if (sizes.length >= 1) {
        setResizeRatio(node.id, sizes[0] / 100);
      }
    },
    [node.id, setResizeRatio],
  );

  return (
    <PanelGroup direction={direction} onLayout={onLayout} className="!h-full">
      <Panel defaultSize={initialA} minSize={15}>
        <div className="h-full w-full overflow-hidden">
          <PaneNode node={node.a} />
        </div>
      </Panel>
      <PanelResizeHandle
        className={
          direction === "horizontal"
            ? "w-px bg-border hover:bg-primary/40 transition-colors data-[resize-handle-active]:bg-primary/70 relative group"
            : "h-px bg-border hover:bg-primary/40 transition-colors data-[resize-handle-active]:bg-primary/70 relative group"
        }
      >
        <div
          className={
            direction === "horizontal"
              ? "absolute inset-y-0 -left-1 -right-1 flex items-center justify-center"
              : "absolute inset-x-0 -top-1 -bottom-1 flex items-center justify-center"
          }
        >
          <span
            className={
              direction === "horizontal"
                ? "w-0.5 h-6 rounded-full bg-muted-foreground/0 group-hover:bg-muted-foreground/40 transition-colors"
                : "h-0.5 w-6 rounded-full bg-muted-foreground/0 group-hover:bg-muted-foreground/40 transition-colors"
            }
          />
        </div>
      </PanelResizeHandle>
      <Panel defaultSize={initialB} minSize={15}>
        <div className="h-full w-full overflow-hidden">
          <PaneNode node={node.b} />
        </div>
      </Panel>
    </PanelGroup>
  );
}

// =====================================================================
// Leaf pane = the actual chat tile
// =====================================================================
function LeafPane({ node }: { node: LeafNode }) {
  const ws = useWorkspace();
  const pane = ws.panes[node.paneId];
  if (!pane) return null;
  return <PaneChat pane={pane} />;
}

// =====================================================================
// Drag-and-drop swap state (module-level, simple)
// =====================================================================
let DRAG_PANE_ID: string | null = null;

// =====================================================================
// Pane chat — independent thread, header, composer
// =====================================================================
function PaneChat({ pane }: { pane: PaneType }) {
  const ws = useWorkspace();
  const runsStore = useRunsStore();
  const model = modelById(pane.modelId);
  const channel = pane.channelId ? ws.channels.find((c) => c.id === pane.channelId) : null;
  const isActive = ws.activePaneId === pane.id;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const surfaceId = `pane-${pane.id}`;
  const { queue, activeRuns, paused } = useSurfaceQueue(surfaceId);
  const isStreaming = activeRuns.length > 0;

  // Track which assistant message id each run is writing into via run.onMeta.
  // (commitId is stored on RunRequest.onMeta.messageId; we read it back in handlers.)
  useSurfaceHandler(surfaceId, {
    onChunk: (req, _runId, full) => {
      const msgId = req.onMeta?.messageId;
      const variantId = (req as any).variantId as string | undefined;
      if (!msgId) return;
      if (variantId) {
        ws.updatePaneMessageVariant(pane.id, msgId, variantId, { content: full });
      } else {
        ws.updatePaneMessage(pane.id, msgId, { content: full });
      }
    },
    onFinish: (req, _runId, finalText, status) => {
      const msgId = req.onMeta?.messageId;
      const variantId = (req as any).variantId as string | undefined;
      if (!msgId) return;
      if (variantId) {
        ws.updatePaneMessageVariant(pane.id, msgId, variantId, {
          content: finalText,
          streaming: false,
          stopped: status === "stopped",
        });
      } else {
        ws.updatePaneMessage(pane.id, msgId, {
          content: finalText,
          streaming: false,
          stopped: status === "stopped",
        });
      }
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [pane.messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsgId = `u-${Date.now()}`;
    const aId = `a-${Date.now()}`;
    const userMsg: PaneMessage = {
      id: userMsgId,
      role: "user",
      content: input,
      channelId: null,
    };
    const assistantMsg: PaneMessage = {
      id: aId,
      role: "assistant",
      modelId: pane.modelId,
      content: "",
      streaming: true,
      channelId: null,
      parentId: userMsgId,
    };
    ws.addPaneMessage(pane.id, userMsg);
    ws.addPaneMessage(pane.id, assistantMsg);
    const promptText = input;
    setInput("");

    const history: Msg[] = [...pane.messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));
    runsStore.submit({
      surfaceId,
      surfaceKind: "workspace",
      paneLabel: `Workspace · ${model.name}`,
      modelId: pane.modelId,
      messages: history,
      promptPreview: promptText,
      onMeta: { messageId: aId },
    });
  };

  /** Cancel the in-flight assistant message */
  const handleCancelMessage = (msgId: string) => {
    for (const m of activeRuns) {
      if (m.onMeta?.messageId === msgId) {
        runsStore.cancel(m.id);
      }
    }
  };

  /** Retry an assistant message — either in place (add variant) or in a new pane (branch). */
  const handleRetry = (msg: PaneMessage, mode: "variant" | "branch", newModelId?: string) => {
    if (!msg.parentId) return;
    // Build history up to the user prompt (parentId)
    const upTo = pane.messages.findIndex((m) => m.id === msg.parentId);
    if (upTo < 0) return;
    const historyMsgs = pane.messages.slice(0, upTo + 1);
    const history: Msg[] = historyMsgs.map((m) => ({ role: m.role, content: m.content }));
    const targetModel = newModelId ?? msg.modelId ?? pane.modelId;

    if (mode === "branch") {
      // Branch the pane up to the user message (NOT the assistant), then submit new
      const newPaneId = ws.branchPane(pane.id, msg.parentId, { newModelId: targetModel });
      if (!newPaneId) return;
      // Wait a tick for the new pane to mount before submitting a run
      setTimeout(() => {
        const newSurfaceId = `pane-${newPaneId}`;
        const newAId = `a-${Date.now()}`;
        ws.addPaneMessage(newPaneId, {
          id: newAId,
          role: "assistant",
          modelId: targetModel,
          content: "",
          streaming: true,
          channelId: null,
          parentId: msg.parentId,
        });
        runsStore.submit({
          surfaceId: newSurfaceId,
          surfaceKind: "workspace",
          paneLabel: `Workspace · ${modelById(targetModel).name}`,
          modelId: targetModel,
          messages: history,
          promptPreview: historyMsgs[historyMsgs.length - 1]?.content ?? "",
          onMeta: { messageId: newAId },
        });
      }, 80);
      return;
    }

    // In-place variant
    const variantId = `v-${Date.now()}`;
    ws.addPaneMessageVariant(pane.id, msg.id, {
      id: variantId,
      modelId: targetModel,
      content: "",
      streaming: true,
    });
    const req: RunRequest = {
      surfaceId,
      surfaceKind: "workspace",
      paneLabel: `Workspace · ${modelById(targetModel).name}`,
      modelId: targetModel,
      messages: history,
      promptPreview: historyMsgs[historyMsgs.length - 1]?.content ?? "",
      onMeta: { messageId: msg.id },
    };
    (req as any).variantId = variantId;
    runsStore.submit(req);
  };

  // ---- Drag-and-drop ----
  const onDragStart = (e: React.DragEvent) => {
    DRAG_PANE_ID = pane.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", pane.id);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (DRAG_PANE_ID && DRAG_PANE_ID !== pane.id) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOver(true);
    }
  };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const sourceId = DRAG_PANE_ID;
    DRAG_PANE_ID = null;
    if (sourceId && sourceId !== pane.id) {
      ws.swapPanes(sourceId, pane.id);
    }
  };

  return (
    <div
      className={`relative h-full flex flex-col bg-background min-w-0 min-h-0 ${
        isActive ? "ring-1 ring-inset ring-primary/60" : ""
      }`}
      onClick={() => ws.setActivePane(pane.id)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-testid={`pane-${pane.id}`}
    >
      {/* Drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-30 pointer-events-none bg-primary/10 border-2 border-dashed border-primary/60 flex items-center justify-center">
          <div className="rounded-md bg-background border border-primary/60 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-primary">
            Swap panes
          </div>
        </div>
      )}

      {/* Header */}
      <div
        draggable
        onDragStart={onDragStart}
        className="h-9 border-b border-border bg-card/40 flex items-center px-2 gap-1.5 shrink-0 cursor-grab active:cursor-grabbing select-none"
      >
        <GripVertical className="w-3 h-3 text-muted-foreground/60 shrink-0" />
        <div className="shrink-0">
          <ModelPicker value={pane.modelId} onChange={(id) => ws.setPaneModel(pane.id, id)} compact align="start" />
        </div>
        <ChannelChip paneId={pane.id} />
        {pane.branchedFrom && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-primary"
            title="This pane is a branch"
          >
            <GitBranch className="w-2.5 h-2.5" />
            branch
          </span>
        )}
        <div className="flex-1 min-w-0" />
        {isStreaming && (
          <span className="text-[9px] font-mono uppercase tracking-wider text-primary inline-flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            streaming
          </span>
        )}
        <SplitMenu paneId={pane.id} />
        <button
          onClick={(e) => {
            e.stopPropagation();
            ws.closePane(pane.id);
          }}
          className="p-1 rounded-md hover-elevate text-muted-foreground"
          aria-label="Close pane"
          data-testid={`button-close-${pane.id}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto nice-scroll min-h-0">
        {pane.messages.length === 0 ? (
          <EmptyPane model={model} onPickPrompt={(p) => setInput(p)} />
        ) : (
          <div className="px-4 py-4 space-y-5">
            {pane.messages.map((m) => (
              <PaneMessageRow
                key={m.id}
                message={m}
                channel={channel ?? null}
                ws={ws}
                paneId={pane.id}
                onCancel={() => handleCancelMessage(m.id)}
                onRetry={(mode, newModelId) => handleRetry(m, mode, newModelId)}
                onBranchFromHere={() => ws.branchPane(pane.id, m.id)}
                isActive={isStreaming}
              />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="px-3 pb-3 pt-2 border-t border-border/60 shrink-0">
        <div className="rounded-lg border border-border bg-card focus-within:ring-1 focus-within:ring-ring/40 focus-within:border-ring/40 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isStreaming
                ? `Queue another message to ${model.name}…`
                : `Message ${model.name} privately…`
            }
            rows={1}
            className="w-full bg-transparent px-3 py-2 text-[13px] resize-none focus:outline-none placeholder:text-muted-foreground"
            data-testid={`input-pane-${pane.id}`}
          />
          <div className="flex items-center justify-between px-2 pb-2 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 truncate">
                private to {model.name}
              </span>
              <QueuePopover
                surfaceId={surfaceId}
                paused={paused}
                onTogglePause={() => runsStore.setPaused(surfaceId, !paused)}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground hover-elevate-2 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid={`button-send-pane-${pane.id}`}
              title={isStreaming ? "Adds to queue" : "Send"}
            >
              {isStreaming && queue.length > 0 ? (
                <span className="text-[10px] font-mono">+{queue.length}</span>
              ) : (
                <ArrowUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Empty pane placeholder
// =====================================================================
function EmptyPane({ model, onPickPrompt }: { model: ReturnType<typeof modelById>; onPickPrompt: (p: string) => void }) {
  const prompts = [
    "Summarize the last three messages in this channel.",
    "What's a contrarian take on this brief?",
    "Draft a one-paragraph version we could send to the team.",
  ];
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className={`${providerClass(model.provider)} inline-flex items-center gap-2 mb-3`}>
          <span className="w-2 h-2 rounded-full provider-dot" />
          <span className="text-[10px] font-mono uppercase tracking-wider provider-text">{model.providerName}</span>
        </div>
        <h3 className="text-sm font-medium mb-1">Ask {model.name} something</h3>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{model.description}</p>
        <div className="space-y-1.5">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => onPickPrompt(p)}
              className="w-full text-left text-[11px] text-foreground/80 rounded-md border border-border bg-card px-2.5 py-1.5 hover-elevate"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Channel chip
// =====================================================================
function ChannelChip({ paneId }: { paneId: string }) {
  const { panes, channels, setPaneChannel } = useWorkspace();
  const pane = panes[paneId];
  if (!pane) return null;
  const channel = pane.channelId ? channels.find((c) => c.id === pane.channelId) : null;
  const c = channel ? CHANNEL_COLORS[channel.color] : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider hover-elevate ${
            channel && c
              ? `${c.border} ${c.bg} ${c.text}`
              : "border-border text-muted-foreground bg-transparent"
          }`}
          onClick={(e) => e.stopPropagation()}
          data-testid={`button-channel-chip-${paneId}`}
        >
          {channel && c ? (
            <>
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              <span>{channel.name}</span>
            </>
          ) : (
            <>
              <Hash className="w-2.5 h-2.5" />
              <span>no channel</span>
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Assign channel
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setPaneChannel(paneId, null)}
          className="text-xs cursor-pointer"
          data-testid={`option-channel-none-${paneId}`}
        >
          <Hash className="w-3 h-3 mr-2 text-muted-foreground" />
          No channel
        </DropdownMenuItem>
        {channels.map((ch) => {
          const col = CHANNEL_COLORS[ch.color];
          return (
            <DropdownMenuItem
              key={ch.id}
              onClick={() => setPaneChannel(paneId, ch.id)}
              className="text-xs cursor-pointer flex items-center gap-2"
              data-testid={`option-channel-${ch.id}-${paneId}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
              <span>{ch.name}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =====================================================================
// Split menu button
// =====================================================================
function SplitMenu({ paneId }: { paneId: string }) {
  const { splitPane } = useWorkspace();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1 rounded-md hover-elevate text-muted-foreground"
          aria-label="Split pane"
          onClick={(e) => e.stopPropagation()}
          data-testid={`button-split-${paneId}`}
        >
          <SplitSquareHorizontal className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => splitPane(paneId, "horizontal")} className="text-xs cursor-pointer">
          <SplitSquareHorizontal className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
          Split right
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => splitPane(paneId, "vertical")} className="text-xs cursor-pointer">
          <SplitSquareVertical className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
          Split down
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =====================================================================
// Per-pane message row — distinguishes channel vs private
// =====================================================================
function PaneMessageRow({
  message,
  channel,
  ws,
  paneId,
  onCancel,
  onRetry,
  onBranchFromHere,
  isActive,
}: {
  message: PaneMessage;
  channel: { id: string; name: string; color: keyof typeof CHANNEL_COLORS } | null;
  ws: ReturnType<typeof useWorkspace>;
  paneId: string;
  onCancel: () => void;
  onRetry: (mode: "variant" | "branch", newModelId?: string) => void;
  onBranchFromHere: () => void;
  isActive: boolean;
}) {
  const channelObj = message.channelId ? ws.channels.find((c) => c.id === message.channelId) : null;
  const col = channelObj ? CHANNEL_COLORS[channelObj.color] : null;
  const isChannel = !!message.channelId;

  if (message.role === "user") {
    return (
      <div className="animate-fade-in">
        {isChannel && col && channelObj && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Radio className={`w-2.5 h-2.5 ${col.text}`} />
            <span className={`text-[9px] font-mono uppercase tracking-wider ${col.text}`}>
              broadcast · {channelObj.name}
            </span>
          </div>
        )}
        <div
          className={`rounded-2xl rounded-tr-md px-3 py-2 text-[13px] leading-relaxed border ${
            isChannel && col
              ? `${col.border} ${col.bg} border-l-2`
              : "border-border/50 bg-muted/60"
          }`}
        >
          {message.content}
        </div>
      </div>
    );
  }

  // assistant — handle variant carousel
  const variants = message.variants ?? [];
  const totalVariants = variants.length + 1; // original + variants
  const activeIdx = message.activeVariant ?? -1; // -1 = original
  const currentVariant = activeIdx >= 0 ? variants[activeIdx] : null;
  const content = currentVariant ? currentVariant.content : message.content;
  const streaming = currentVariant ? currentVariant.streaming : message.streaming;
  const stopped = currentVariant ? currentVariant.stopped : message.stopped;
  const displayedModelId = currentVariant?.modelId ?? message.modelId ?? "gpt-5";
  const model = modelById(displayedModelId);

  return (
    <div className="animate-fade-in group">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <ModelBadge model={model} size="xs" active={!!streaming} />
        {isChannel && col && channelObj && (
          <span
            className={`inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider ${col.text}`}
          >
            <span className={`w-1 h-1 rounded-full ${col.dot}`} />
            from {channelObj.name}
          </span>
        )}
        {streaming && (
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
            streaming
          </span>
        )}
        {stopped && !streaming && (
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
            stopped
          </span>
        )}
        {totalVariants > 1 && (
          <VariantCarousel
            total={totalVariants}
            activeIdx={activeIdx}
            onSelect={(idx) => ws.setActiveVariant(paneId, message.id, idx)}
          />
        )}
        {(message.branchPaneIds?.length ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-primary">
            <GitBranch className="w-2.5 h-2.5" />
            branched
          </span>
        )}
        <div className="flex-1" />
        {/* Action row — visible on hover */}
        <div className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-0.5 transition-opacity">
          {streaming ? (
            <button
              onClick={onCancel}
              className="p-1 rounded hover-elevate text-muted-foreground hover:text-destructive"
              title="Stop"
              data-testid={`button-cancel-msg-${message.id}`}
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <>
              <RetryButton onRetry={onRetry} currentModelId={message.modelId ?? "gpt-5"} />
              <button
                onClick={onBranchFromHere}
                className="p-1 rounded hover-elevate text-muted-foreground"
                title="Branch from here"
                data-testid={`button-branch-msg-${message.id}`}
              >
                <GitBranch className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
      <div
        className={`text-[13px] leading-relaxed text-foreground/95 whitespace-pre-wrap ${
          isChannel && col ? `border-l-2 ${col.border} pl-3` : ""
        }`}
      >
        <span className={streaming ? "stream-cursor" : ""}>{content}</span>
      </div>
    </div>
  );
}

function VariantCarousel({
  total,
  activeIdx,
  onSelect,
}: {
  total: number;
  activeIdx: number;
  // activeIdx: -1 = original, 0+ = variants
  onSelect: (idx: number) => void;
}) {
  // Display number: 1 = original, 2..n = variants
  const displayed = activeIdx + 2;
  const prev = () => {
    if (activeIdx > -1) onSelect(activeIdx - 1);
  };
  const next = () => {
    if (activeIdx < total - 2) onSelect(activeIdx + 1);
  };
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card/60 px-1 py-0">
      <button
        onClick={prev}
        disabled={activeIdx <= -1}
        className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
        aria-label="Previous variant"
      >
        <ChevronLeft className="w-2.5 h-2.5" />
      </button>
      <span className="px-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {displayed}/{total}
      </span>
      <button
        onClick={next}
        disabled={activeIdx >= total - 2}
        className="p-0.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
        aria-label="Next variant"
      >
        <ChevronRight className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

function RetryButton({
  onRetry,
  currentModelId,
}: {
  onRetry: (mode: "variant" | "branch", newModelId?: string) => void;
  currentModelId: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1 rounded hover-elevate text-muted-foreground inline-flex items-center gap-0.5"
          title="Retry"
          data-testid={`button-retry-msg`}
          onClick={(e) => e.stopPropagation()}
        >
          <RotateCcw className="w-3 h-3" />
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Retry in place
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onRetry("variant")}
          className="text-xs cursor-pointer"
        >
          Same model ({modelById(currentModelId).name})
        </DropdownMenuItem>
        {MODELS.filter((m) => m.id !== currentModelId)
          .slice(0, 4)
          .map((m) => (
            <DropdownMenuItem
              key={m.id}
              onClick={() => onRetry("variant", m.id)}
              className="text-xs cursor-pointer"
            >
              {m.name}
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Branch to new pane
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onRetry("branch")} className="text-xs cursor-pointer">
          Same model in new pane
        </DropdownMenuItem>
        {MODELS.filter((m) => m.id !== currentModelId)
          .slice(0, 3)
          .map((m) => (
            <DropdownMenuItem
              key={`branch-${m.id}`}
              onClick={() => onRetry("branch", m.id)}
              className="text-xs cursor-pointer"
            >
              {m.name}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =====================================================================
// Mobile stack — collapse layout tree to vertical stack
// =====================================================================
function MobileStack() {
  const { layout, panes } = useWorkspace();
  const paneIds = useMemo(() => flattenLeaves(layout), [layout]);
  return (
    <div className="h-full overflow-y-auto nice-scroll">
      <div className="flex flex-col">
        {paneIds.map((pid) => {
          const p = panes[pid];
          if (!p) return null;
          return (
            <div key={pid} className="min-h-[420px] border-b border-border">
              <PaneChat pane={p} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
