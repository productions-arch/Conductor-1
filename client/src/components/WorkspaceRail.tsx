import { useEffect, useState } from "react";
import { Info, Radio, Plus, Trash2, Pencil, Send, Loader2, Hash, Users } from "lucide-react";
import {
  useWorkspace,
  CHANNEL_COLORS,
  type BroadcastEntry,
} from "@/lib/workspace-store";
import { modelById } from "@/lib/models";
import { ModelBadge } from "./ModelBadge";
import { type ChatMessage as Msg } from "@/lib/ai-gateway";
import { useRunsStore, useRunsState } from "@/lib/runs-store";

export function WorkspaceRail() {
  const ws = useWorkspace();
  const activePane = ws.activePaneId ? ws.panes[ws.activePaneId] : null;
  const activeModel = activePane ? modelById(activePane.modelId) : null;
  const activeChannel = activePane?.channelId
    ? ws.channels.find((c) => c.id === activePane.channelId)
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
        <Info className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Workspace
        </span>
      </div>

      <div className="flex-1 overflow-y-auto nice-scroll">
        {/* Active pane info */}
        <Section title="Active pane">
          {activePane && activeModel ? (
            <div className="rounded-md border border-border bg-card/50 p-3">
              <ModelBadge model={activeModel} size="sm" active />
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-2">
                {activeModel.providerName}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5">
                {activeModel.description}
              </p>
              <div className="mt-3 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <span>channel</span>
                <span>
                  {activeChannel ? (
                    <span className={`inline-flex items-center gap-1 ${CHANNEL_COLORS[activeChannel.color].text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${CHANNEL_COLORS[activeChannel.color].dot}`} />
                      {activeChannel.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/70">private</span>
                  )}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <span>messages</span>
                <span>{activePane.messages.length}</span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">No pane selected.</div>
          )}
        </Section>

        {/* Broadcast composer */}
        <Section title="Broadcast">
          <BroadcastComposer />
        </Section>

        {/* Channel manager */}
        <Section title="Channels">
          <ChannelManager />
        </Section>

        {/* How it works */}
        <Section title="How it works">
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-[11px] leading-relaxed text-foreground/85">
            <p>
              Each pane is an independent thread. Switch its model anytime — the conversation context comes along.
            </p>
            <p>
              Assign panes to a <span className="font-mono text-primary">channel</span> to share context. Broadcast a message and every pane in that channel answers — and sees the others' answers on the next turn.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-border/60">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

// =====================================================================
// Broadcast composer
// =====================================================================
function BroadcastComposer() {
  const ws = useWorkspace();
  const runsStore = useRunsStore();
  const runsState = useRunsState();
  const [text, setText] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string | null>(ws.channels[0]?.id ?? null);

  // Panes subscribed to selected channel
  const subscribedPanes = selectedChannel
    ? Object.values(ws.panes).filter((p) => p.channelId === selectedChannel)
    : [];

  // Count active broadcasts (one surface per pane in this broadcast)
  const activeBroadcastCount = selectedChannel
    ? Array.from(runsState.activeRuns.values()).filter((r) =>
        r.surfaceId.startsWith(`broadcast-${selectedChannel}-`),
      ).length
    : 0;

  // Register handlers for each pane's broadcast surface (idempotent)
  useEffect(() => {
    if (!selectedChannel) return;
    const channelId = selectedChannel;
    const cleanups: Array<() => void> = [];
    for (const pane of subscribedPanes) {
      const surfaceId = `broadcast-${channelId}-${pane.id}`;
      runsStore.registerSurface(surfaceId, {
        onChunk: (req, _runId, full) => {
          const entryId = req.onMeta?.messageId;
          if (entryId) ws.updateChannelEntry(channelId, entryId, { content: full });
        },
        onFinish: (req, _runId, finalText, _status) => {
          const entryId = req.onMeta?.messageId;
          if (entryId)
            ws.updateChannelEntry(channelId, entryId, {
              content: finalText,
              streaming: false,
            });
        },
      });
      cleanups.push(() => runsStore.unregisterSurface(surfaceId));
    }
    return () => {
      for (const c of cleanups) c();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel, subscribedPanes.map((p) => p.id).join(",")]);

  const handleBroadcast = () => {
    if (!text.trim() || !selectedChannel) return;
    const channelId = selectedChannel;
    const userEntry: BroadcastEntry = {
      id: `bx-u-${Date.now()}`,
      channelId,
      role: "user",
      content: text,
    };
    ws.addChannelEntry(channelId, userEntry);
    const msg = text;
    setText("");

    // For each subscribed pane, submit a run via the runs-store. They run
    // concurrently across panes; per-pane order is preserved by the queue.
    const panes = Object.values(ws.panes).filter((p) => p.channelId === channelId);

    for (const pane of panes) {
      const aId = `bx-a-${Date.now()}-${pane.id}`;
      const placeholder: BroadcastEntry = {
        id: aId,
        channelId,
        role: "assistant",
        modelId: pane.modelId,
        authorPaneId: pane.id,
        content: "",
        streaming: true,
      };
      ws.addChannelEntry(channelId, placeholder);

      const history: Msg[] = [
        ...pane.messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: msg },
      ];

      runsStore.submit({
        surfaceId: `broadcast-${channelId}-${pane.id}`,
        surfaceKind: "workspace",
        paneLabel: `Broadcast · ${modelById(pane.modelId).name}`,
        modelId: pane.modelId,
        messages: history,
        promptPreview: msg,
        onMeta: { messageId: aId },
      });
    }
  };
  const broadcasting = activeBroadcastCount > 0;

  return (
    <div>
      <div className="rounded-md border border-border bg-card focus-within:ring-1 focus-within:ring-ring/40 focus-within:border-ring/40 transition-colors">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Send to every pane in a channel…"
          rows={3}
          className="w-full bg-transparent px-3 py-2 text-[12px] resize-none focus:outline-none placeholder:text-muted-foreground"
          data-testid="input-broadcast"
        />
      </div>

      {/* Channel buttons */}
      <div className="mt-2 flex flex-wrap gap-1">
        {ws.channels.length === 0 ? (
          <div className="text-[10px] text-muted-foreground italic">Create a channel below first.</div>
        ) : (
          ws.channels.map((ch) => {
            const col = CHANNEL_COLORS[ch.color];
            const active = selectedChannel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider hover-elevate transition-colors ${
                  active
                    ? `${col.border} ${col.bg} ${col.text}`
                    : "border-border text-muted-foreground"
                }`}
                data-testid={`button-bx-channel-${ch.id}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                {ch.name}
              </button>
            );
          })
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <Users className="w-3 h-3" />
          {subscribedPanes.length} pane{subscribedPanes.length === 1 ? "" : "s"}
        </div>
        <button
          onClick={handleBroadcast}
          disabled={!text.trim() || !selectedChannel || subscribedPanes.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-medium hover-elevate-2 disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="button-broadcast"
          title={broadcasting ? "Another broadcast in flight — this one will queue per pane" : "Broadcast"}
        >
          {broadcasting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
          Broadcast
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Channel manager
// =====================================================================
function ChannelManager() {
  const { channels, createChannel, deleteChannel, renameChannel, panes } = useWorkspace();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = () => {
    const n = newName.trim();
    if (!n) return;
    createChannel(n);
    setNewName("");
  };

  return (
    <div>
      <div className="space-y-1">
        {channels.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic">No channels yet.</div>
        ) : (
          channels.map((ch) => {
            const col = CHANNEL_COLORS[ch.color];
            const count = Object.values(panes).filter((p) => p.channelId === ch.id).length;
            const editing = editingId === ch.id;
            return (
              <div
                key={ch.id}
                className="group flex items-center gap-2 rounded-md border border-border bg-card/40 px-2 py-1.5"
                data-testid={`channel-row-${ch.id}`}
              >
                <span className={`w-2 h-2 rounded-full ${col.dot} shrink-0`} />
                {editing ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => {
                      if (editName.trim()) renameChannel(ch.id, editName.trim());
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (editName.trim()) renameChannel(ch.id, editName.trim());
                        setEditingId(null);
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    className="flex-1 min-w-0 bg-transparent text-xs focus:outline-none border-b border-border"
                  />
                ) : (
                  <span className="flex-1 min-w-0 text-xs truncate">{ch.name}</span>
                )}
                <span className="text-[10px] font-mono text-muted-foreground">{count}</span>
                <button
                  onClick={() => {
                    setEditingId(ch.id);
                    setEditName(ch.name);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover-elevate text-muted-foreground"
                  aria-label="Rename"
                  data-testid={`button-rename-channel-${ch.id}`}
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteChannel(ch.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover-elevate text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                  data-testid={`button-delete-channel-${ch.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-2 flex items-center gap-1">
        <div className="flex-1 rounded-md border border-border bg-card focus-within:ring-1 focus-within:ring-ring/40 focus-within:border-ring/40 transition-colors flex items-center px-2">
          <Hash className="w-3 h-3 text-muted-foreground shrink-0" />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="New channel name"
            className="flex-1 bg-transparent px-2 py-1.5 text-xs focus:outline-none placeholder:text-muted-foreground"
            data-testid="input-new-channel"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground hover-elevate-2 disabled:opacity-40"
          aria-label="Create channel"
          data-testid="button-create-channel"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
