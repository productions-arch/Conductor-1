import { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  Sparkles,
  Paperclip,
  X,
  GitBranch,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Share2,
  Check,
  FileText,
} from "lucide-react";
import { useDocuments } from "@/lib/documents-store";
import { ModelPicker } from "./ModelPicker";
import { ModelBadge } from "./ModelBadge";
import { modelById, providerClass, MODELS } from "@/lib/models";
import { type ChatMessage as Msg } from "@/lib/ai-gateway";
import { useChatStore, type ChatMsg } from "@/lib/chat-store";
import { useAuth } from "@/lib/auth-store";
import { useGatewayMode } from "@/hooks/use-gateway-mode";
import { MessageFeedback } from "./FeedbackWidget";
import {
  useRunsStore,
  useSurfaceHandler,
  useSurfaceQueue,
  useQueueTip,
} from "@/lib/runs-store";
import { QueuePopover, QueueChip } from "./ActivityDock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ChatMode() {
  const chat = useChatStore();
  const docs = useDocuments();
  const activeThread = chat.threads[chat.activeThreadId];
  const messages = activeThread?.messages ?? [];
  const surfaceId = `chat-${chat.activeThreadId}`;
  const surfaceQueue = useSurfaceQueue(surfaceId);
  const store = useRunsStore();
  const [input, setInput] = useState("");
  const [modelId, setModelId] = useState("claude-opus-4");
  const [sharing, setSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function pushToDoc(content: string) {
    const title = content.slice(0, 60).trim() + (content.length > 60 ? "…" : "");
    const html = content
      .split(/\n\n+/)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");
    docs.createDocument("general", title || "From Chat", html);
  }

  async function handleShare() {
    if (sharing || !messages.length) return;
    setSharing(true);
    try {
      const snapshot = messages.map((m) => ({
        role: m.role,
        content: m.content,
        modelId: m.modelId,
      }));
      const r = await fetch("/api/share", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: activeThread?.title ?? "Shared conversation",
          mode: "chat",
          snapshot,
        }),
      });
      if (!r.ok) return;
      const { token } = await r.json();
      const url = `${window.location.origin}${window.location.pathname}#/share/${token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } finally {
      setSharing(false);
    }
  }

  // Register a surface handler so the runs-store can commit chunks back into the thread.
  // `req.onMeta.messageId` carries the assistant placeholder id.
  useSurfaceHandler(surfaceId, {
    onChunk: (req, _runId, full) => {
      const aId = req.onMeta?.messageId;
      if (!aId) return;
      // Is this a variant?
      const variantId = (req as any).variantId;
      const parentMsgId = (req as any).variantParentId;
      if (variantId && parentMsgId) {
        chat.updateVariant(chat.activeThreadId, parentMsgId, variantId, { content: full });
      } else {
        chat.updateMessage(chat.activeThreadId, aId, { content: full });
      }
    },
    onFinish: (req, _runId, finalText, status) => {
      const aId = req.onMeta?.messageId;
      if (!aId) return;
      const variantId = (req as any).variantId;
      const parentMsgId = (req as any).variantParentId;
      if (variantId && parentMsgId) {
        chat.updateVariant(chat.activeThreadId, parentMsgId, variantId, {
          content: finalText,
          streaming: false,
          stopped: status === "stopped",
        });
      } else {
        chat.updateMessage(chat.activeThreadId, aId, {
          content: finalText,
          streaming: false,
          stopped: status === "stopped",
        });
      }
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, chat.activeThreadId]);

  const auth = useAuth();
  const gatewayMode = useGatewayMode();
  const handleSend = () => {
    if (!input.trim()) return;
    // Gate: if the user is logged-out OR has no key, route through the auth flow
    // before allowing a real call. In demo mode the mock path keeps running.
    if (gatewayMode === "mock" && (auth.user == null || !auth.hasKey)) {
      // Allow the mocked response — the demo experience — but also surface the
      // sign-in dialog so the user knows they need an account for real models.
      if (!auth.user) {
        auth.openSignIn("Sign in (and add an OpenRouter key) to send to real models. Demo continues meanwhile.");
      } else if (!auth.hasKey) {
        auth.openKeyModal();
      }
      // Continue and let the mock fall through — never block the demo.
    }
    const userMsg: ChatMsg = { id: uid("u"), role: "user", content: input };
    const aMsgId = uid("a");
    const assistantMsg: ChatMsg = {
      id: aMsgId,
      role: "assistant",
      modelId,
      content: "",
      streaming: true,
      parentId: userMsg.id,
    };
    chat.addMessage(chat.activeThreadId, userMsg);
    chat.addMessage(chat.activeThreadId, assistantMsg);

    const history: Msg[] = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    store.submit({
      surfaceId,
      surfaceKind: "chat",
      paneLabel: `Chat \u00b7 ${activeThread?.title ?? ""}`,
      modelId,
      messages: history,
      promptPreview: input,
      onMeta: { messageId: aMsgId },
    });
    setInput("");
  };

  const retryWithModel = (assistantMsgId: string, newModelId: string) => {
    // Re-run with the same context up to the user prompt that produced this assistant turn
    const idx = messages.findIndex((m) => m.id === assistantMsgId);
    if (idx < 0) return;
    const upTo = messages.slice(0, idx); // history not including this assistant turn
    const history: Msg[] = upTo.map((m) => ({ role: m.role, content: m.content }));
    const variantId = uid("v");
    chat.addVariant(chat.activeThreadId, assistantMsgId, {
      id: variantId,
      modelId: newModelId,
      content: "",
      streaming: true,
    });
    const req: any = {
      surfaceId,
      surfaceKind: "chat",
      paneLabel: `Chat \u00b7 retry`,
      modelId: newModelId,
      messages: history,
      promptPreview: `retry: ${upTo[upTo.length - 1]?.content?.slice(0, 60) ?? ""}`,
      onMeta: { messageId: assistantMsgId },
      variantId,
      variantParentId: assistantMsgId,
    };
    store.submit(req);
  };

  const branchAt = (msgId: string) => {
    const newId = chat.branchThread(chat.activeThreadId, msgId);
    if (newId) chat.setActiveThread(newId);
  };

  const threads = Object.values(chat.threads);

  return (
    <div className="h-full flex flex-col">
      {/* Thread tabs (if more than one thread) */}
      {threads.length > 1 && (
        <div className="px-3 py-2 border-b border-border flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => chat.setActiveThread(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs whitespace-nowrap ${
                t.id === chat.activeThreadId
                  ? "bg-card border border-border text-foreground"
                  : "text-muted-foreground hover-elevate"
              }`}
              data-testid={`tab-thread-${t.id}`}
            >
              {t.branchedFrom && <GitBranch className="w-2.5 h-2.5" />}
              <span className="truncate max-w-[160px]">{t.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Thread header */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <div>
          <div className="text-sm font-medium flex items-center gap-2">
            {activeThread?.title ?? "Untitled thread"}
            <QueueChip surfaceId={surfaceId} />
          </div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {messages.filter((m) => m.role === "assistant").length} responses \u00b7 multi-model
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {[...new Set(messages.filter((m) => m.modelId).map((m) => m.modelId!))].slice(0, 4).map((mid) => {
            const m = modelById(mid);
            return (
              <span key={mid} className={`${providerClass(m.provider)} w-1.5 h-1.5 rounded-full provider-dot`} title={m.name} />
            );
          })}
          {messages.length > 0 && (
            <button
              onClick={handleShare}
              disabled={sharing}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1 hover-elevate"
              title="Copy share link"
              data-testid="button-share-chat"
            >
              {shareCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Share2 className="w-3 h-3" />}
              {shareCopied ? "Copied!" : "Share"}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto nice-scroll">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          {messages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              onBranch={() => branchAt(m.id)}
              onRetryModel={(mid) => retryWithModel(m.id, mid)}
              onCancel={(streamingMsgId) => {
                for (const run of surfaceQueue.activeRuns) {
                  if (run.onMeta?.messageId === streamingMsgId) {
                    store.cancel(run.id);
                  }
                }
              }}
              onSelectVariant={(idx) => chat.setActiveVariant(chat.activeThreadId, m.id, idx)}
              branchThreadIds={m.branchThreadIds ?? []}
              onJumpBranch={(tid) => chat.setActiveThread(tid)}
              onPushToDoc={pushToDoc}
            />
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="px-6 pb-6 pt-3 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-xl border border-border bg-card focus-within:ring-1 focus-within:ring-ring/40 focus-within:border-ring/40 transition-colors">
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
                surfaceQueue.isRunning
                  ? "Streaming\u2026 type to queue another prompt."
                  : "Ask anything. Pick the model on the right."
              }
              rows={2}
              className="w-full bg-transparent px-4 py-3 text-sm resize-none focus:outline-none placeholder:text-muted-foreground"
              data-testid="input-chat"
            />
            <div className="flex items-center justify-between px-3 pb-2.5 gap-2">
              <button className="p-1.5 rounded-md hover-elevate text-muted-foreground" aria-label="Attach" data-testid="button-attach">
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <ChatQueueIndicator surfaceId={surfaceId} paused={surfaceQueue.paused} />
              <div className="flex-1" />
              <div data-tour="model-picker">
                <ModelPicker value={modelId} onChange={setModelId} />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground hover-elevate-2 disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="button-send"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="mt-2 px-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
            <Sparkles className="w-3 h-3" />
            All models share the full conversation context. Submit again to queue.
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatQueueIndicator({ surfaceId, paused }: { surfaceId: string; paused?: boolean }) {
  const store = useRunsStore();
  const [tipVisible, dismissTip] = useQueueTip();
  const { queue } = useSurfaceQueue(surfaceId);
  if (queue.length === 0) return null;
  return (
    <div className="relative">
      <QueuePopover
        surfaceId={surfaceId}
        paused={paused}
        onTogglePause={() => store.setPaused(surfaceId, !paused)}
      />
      {tipVisible && (
        <div className="absolute bottom-full mb-2 left-0 w-64 rounded-md border border-primary/40 bg-popover px-3 py-2 text-[11px] text-foreground/90 shadow-lg z-50">
          <div className="flex items-start gap-2">
            <Sparkles className="w-3 h-3 text-primary mt-0.5 shrink-0" />
            <div>Queue another prompt \u2014 runs as soon as the current one finishes.</div>
            <button onClick={dismissTip} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageRow({
  message,
  onBranch,
  onRetryModel,
  onCancel,
  onSelectVariant,
  branchThreadIds,
  onJumpBranch,
  onPushToDoc,
}: {
  message: ChatMsg;
  onBranch: () => void;
  onRetryModel: (modelId: string) => void;
  onCancel: (msgId: string) => void;
  onSelectVariant: (idx: number) => void;
  branchThreadIds: string[];
  onJumpBranch: (tid: string) => void;
  onPushToDoc: (content: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-fade-in group">
        <div className="max-w-[85%]">
          <div className="rounded-2xl rounded-tr-md bg-muted/60 px-4 py-3 text-sm leading-relaxed border border-border/50 relative">
            {message.content}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1 mt-1">
            <button
              onClick={onBranch}
              className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground rounded-md px-1.5 py-0.5 hover-elevate"
              title="Branch from here"
              data-testid={`button-branch-${message.id}`}
            >
              <GitBranch className="w-2.5 h-2.5" /> Branch
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Assistant — possibly with variants
  const variants = message.variants ?? [];
  const activeIdx = message.activeVariant ?? -1;
  const view =
    activeIdx >= 0 && variants[activeIdx]
      ? {
          modelId: variants[activeIdx].modelId,
          content: variants[activeIdx].content,
          streaming: !!variants[activeIdx].streaming,
          stopped: !!variants[activeIdx].stopped,
        }
      : {
          modelId: message.modelId ?? "gpt-5",
          content: message.content,
          streaming: !!message.streaming,
          stopped: !!message.stopped,
        };
  const model = modelById(view.modelId);
  const totalVariants = 1 + variants.length;

  return (
    <div className="animate-fade-in group group/msg">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <ModelBadge model={model} size="sm" active={view.streaming} />
        {!view.streaming && <MessageFeedback messageId={message.id} />}
        {view.streaming && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">streaming</span>
        )}
        {view.stopped && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-destructive">stopped</span>
        )}

        {totalVariants > 1 && (
          <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card px-1 py-0.5">
            <button
              onClick={() => onSelectVariant(Math.max(-1, activeIdx - 1))}
              disabled={activeIdx <= -1}
              className="p-0.5 rounded hover-elevate text-muted-foreground disabled:opacity-30"
              aria-label="Previous variant"
              data-testid={`button-variant-prev-${message.id}`}
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground px-1">
              {activeIdx === -1 ? "1" : activeIdx + 2}/{totalVariants}
            </span>
            <button
              onClick={() => onSelectVariant(Math.min(variants.length - 1, activeIdx + 1))}
              disabled={activeIdx >= variants.length - 1}
              className="p-0.5 rounded hover-elevate text-muted-foreground disabled:opacity-30"
              aria-label="Next variant"
              data-testid={`button-variant-next-${message.id}`}
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {branchThreadIds.length > 0 && (
          <BranchIndicator threadIds={branchThreadIds} onJump={onJumpBranch} />
        )}

        <div className="flex-1" />

        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          {view.streaming && (
            <button
              onClick={() => onCancel(message.id)}
              className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-destructive rounded-md px-1.5 py-0.5 hover-elevate"
              title="Cancel"
              data-testid={`button-cancel-msg-${message.id}`}
            >
              <X className="w-2.5 h-2.5" /> Stop
            </button>
          )}
          {!view.streaming && view.content && (
            <button
              onClick={() => onPushToDoc(view.content)}
              className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-primary rounded-md px-1.5 py-0.5 hover-elevate"
              title="Push to document"
            >
              <FileText className="w-2.5 h-2.5" /> Push to Doc
            </button>
          )}
          <button
            onClick={onBranch}
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground rounded-md px-1.5 py-0.5 hover-elevate"
            title="Branch from here"
            data-testid={`button-branch-${message.id}`}
          >
            <GitBranch className="w-2.5 h-2.5" /> Branch
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground rounded-md px-1.5 py-0.5 hover-elevate"
                title="Retry with different model"
                data-testid={`button-retry-msg-${message.id}`}
              >
                <RotateCcw className="w-2.5 h-2.5" /> Retry
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Retry with
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {MODELS.filter((m) => m.id !== view.modelId).map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => onRetryModel(m.id)}
                  className="text-xs cursor-pointer flex items-center gap-2"
                  data-testid={`menu-retry-${message.id}-${m.id}`}
                >
                  <span className={`${providerClass(m.provider)} w-1.5 h-1.5 rounded-full provider-dot`} />
                  <span>{m.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="prose prose-sm prose-invert max-w-none text-foreground/95 whitespace-pre-wrap leading-relaxed">
        <span className={view.streaming ? "stream-cursor" : ""}>{view.content}</span>
      </div>
    </div>
  );
}

function BranchIndicator({ threadIds, onJump }: { threadIds: string[]; onJump: (tid: string) => void }) {
  const chat = useChatStore();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover-elevate"
          data-testid="button-branch-indicator"
        >
          <GitBranch className="w-2.5 h-2.5" />
          {threadIds.length} branch{threadIds.length === 1 ? "" : "es"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Branches from this message
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {threadIds.map((tid) => {
          const t = chat.threads[tid];
          if (!t) return null;
          return (
            <DropdownMenuItem
              key={tid}
              onClick={() => onJump(tid)}
              className="text-xs cursor-pointer flex items-center gap-2"
            >
              <GitBranch className="w-3 h-3 text-muted-foreground" />
              <span className="truncate">{t.title}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Unused but imported above for completeness
void Plus;
void MoreHorizontal;
