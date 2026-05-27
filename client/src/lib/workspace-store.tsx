import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

// ---------- Types ----------
export interface PaneMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string; // assistant only
  streaming?: boolean;
  stopped?: boolean; // user cancelled mid-stream
  channelId?: string | null; // null/undefined = private
  // For channel messages we track which pane authored the response so
  // that the same message can show up across all panes in the channel
  // attributed correctly.
  authorPaneId?: string;
  /** parent message id — used for branching (the user message that prompted this assistant turn) */
  parentId?: string;
  /** Variants — other assistant responses generated for the same prompt (retry with different model) */
  variants?: Array<{ id: string; modelId: string; content: string; streaming?: boolean; stopped?: boolean }>;
  /** Currently visible variant index (-1 = the original). Default -1. */
  activeVariant?: number;
  /** Pane IDs that were branched from this message */
  branchPaneIds?: string[];
}

export interface Pane {
  id: string;
  modelId: string;
  channelId?: string | null;
  messages: PaneMessage[];
  streaming?: boolean;
  /** Pane this pane was branched from (display only) */
  branchedFrom?: { paneId: string; messageId: string };
}

export interface Channel {
  id: string;
  name: string;
  color: ChannelColor;
}

export type ChannelColor = "amber" | "cyan" | "violet" | "rose" | "sky" | "lime";

export interface BroadcastEntry {
  id: string;
  channelId: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string;
  authorPaneId?: string;
  streaming?: boolean;
}

// Layout tree — binary tree of splits + leaves
export type LayoutNode = SplitNode | LeafNode;

export interface SplitNode {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical"; // horizontal = side-by-side, vertical = stacked
  ratio: number; // 0..1 — share of the first child
  a: LayoutNode;
  b: LayoutNode;
}

export interface LeafNode {
  type: "leaf";
  id: string;
  paneId: string;
}

// ---------- Channel color tokens ----------
export const CHANNEL_COLORS: Record<ChannelColor, { dot: string; border: string; bg: string; text: string; hex: string }> = {
  amber: { dot: "bg-amber-400", border: "border-amber-400/50", bg: "bg-amber-400/10", text: "text-amber-300", hex: "#fbbf24" },
  cyan: { dot: "bg-cyan-400", border: "border-cyan-400/50", bg: "bg-cyan-400/10", text: "text-cyan-300", hex: "#22d3ee" },
  violet: { dot: "bg-violet-400", border: "border-violet-400/50", bg: "bg-violet-400/10", text: "text-violet-300", hex: "#a78bfa" },
  rose: { dot: "bg-rose-400", border: "border-rose-400/50", bg: "bg-rose-400/10", text: "text-rose-300", hex: "#fb7185" },
  sky: { dot: "bg-sky-400", border: "border-sky-400/50", bg: "bg-sky-400/10", text: "text-sky-300", hex: "#38bdf8" },
  lime: { dot: "bg-lime-400", border: "border-lime-400/50", bg: "bg-lime-400/10", text: "text-lime-300", hex: "#a3e635" },
};

export const CHANNEL_COLOR_ORDER: ChannelColor[] = ["amber", "cyan", "violet", "rose", "sky", "lime"];

// ---------- Store / Context ----------
interface WorkspaceState {
  panes: Record<string, Pane>;
  channels: Channel[];
  channelMessages: Record<string, BroadcastEntry[]>; // channelId -> entries
  layout: LayoutNode;
  activePaneId: string | null;
}

interface WorkspaceActions {
  setActivePane: (paneId: string) => void;
  splitPane: (paneId: string, direction: "horizontal" | "vertical") => void;
  closePane: (paneId: string) => void;
  resetLayout: () => void;
  applyPreset: (preset: PresetKey) => void;
  setPaneModel: (paneId: string, modelId: string) => void;
  setPaneChannel: (paneId: string, channelId: string | null) => void;
  swapPanes: (a: string, b: string) => void;
  addPaneMessage: (paneId: string, msg: PaneMessage) => void;
  updatePaneMessage: (paneId: string, msgId: string, patch: Partial<PaneMessage>) => void;
  setPaneStreaming: (paneId: string, streaming: boolean) => void;
  addChannelEntry: (channelId: string, entry: BroadcastEntry) => void;
  updateChannelEntry: (channelId: string, entryId: string, patch: Partial<BroadcastEntry>) => void;
  createChannel: (name: string) => string;
  renameChannel: (channelId: string, name: string) => void;
  deleteChannel: (channelId: string) => void;
  setResizeRatio: (splitId: string, ratio: number) => void;
  /** Branch a pane up to a given message — creates a new pane with messages up to and including msgId. */
  branchPane: (paneId: string, untilMessageId: string, opts?: { newModelId?: string }) => string | null;
  /** Add a variant to an assistant message (for retry-with-different-model) */
  addPaneMessageVariant: (paneId: string, msgId: string, variant: { id: string; modelId: string; content: string; streaming?: boolean }) => void;
  updatePaneMessageVariant: (paneId: string, msgId: string, variantId: string, patch: Partial<{ content: string; streaming: boolean; stopped: boolean }>) => void;
  setActiveVariant: (paneId: string, msgId: string, variantIdx: number) => void;
}

type WorkspaceContextValue = WorkspaceState & WorkspaceActions;

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// ---------- Layout helpers ----------
function findLeaf(node: LayoutNode, paneId: string): LeafNode | null {
  if (node.type === "leaf") return node.paneId === paneId ? node : null;
  return findLeaf(node.a, paneId) ?? findLeaf(node.b, paneId);
}

function replaceLeaf(
  node: LayoutNode,
  paneId: string,
  replacer: (leaf: LeafNode) => LayoutNode,
): LayoutNode {
  if (node.type === "leaf") {
    return node.paneId === paneId ? replacer(node) : node;
  }
  return {
    ...node,
    a: replaceLeaf(node.a, paneId, replacer),
    b: replaceLeaf(node.b, paneId, replacer),
  };
}

function removeLeaf(node: LayoutNode, paneId: string): LayoutNode | null {
  if (node.type === "leaf") return node.paneId === paneId ? null : node;
  const a = removeLeaf(node.a, paneId);
  const b = removeLeaf(node.b, paneId);
  if (!a && !b) return null;
  if (!a) return b!;
  if (!b) return a!;
  return { ...node, a, b };
}

function collectLeaves(node: LayoutNode): LeafNode[] {
  if (node.type === "leaf") return [node];
  return [...collectLeaves(node.a), ...collectLeaves(node.b)];
}

function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------- Initial mock state ----------
function buildInitialState(): WorkspaceState {
  // Four panes for a 2x2: TL=Claude, TR=GPT-5, BL=Gemini, BR=DeepSeek
  const p1 = "pane-claude";
  const p2 = "pane-gpt5";
  const p3 = "pane-gemini";
  const p4 = "pane-deepseek";

  const chId = "channel-brainstorm";
  const brainstorm: Channel = { id: chId, name: "Brainstorm", color: "amber" };

  // Pre-existing broadcast: user asks both, both respond
  const broadcastUserId = "bx-user-1";
  const broadcastClaudeId = "bx-asst-claude";
  const broadcastGptId = "bx-asst-gpt";

  const broadcastUser: BroadcastEntry = {
    id: broadcastUserId,
    channelId: chId,
    role: "user",
    content: "Brainstorm three angles for a relaunch of a 90s skateboard brand for Gen Z. One sentence each.",
  };
  const claudeReply: BroadcastEntry = {
    id: broadcastClaudeId,
    channelId: chId,
    role: "assistant",
    modelId: "claude-opus-4",
    authorPaneId: p1,
    content:
      "1. Lean into archival authenticity — open the vault: re-release the original graphics with verified provenance and serialized boards.\n2. Make the brand a platform for skater-filmmakers, funding short films in exchange for first-screening rights.\n3. Build a physical-digital loop: every board comes with a wearable NFC tag that unlocks rider footage tied to that exact deck.",
  };
  const gptReply: BroadcastEntry = {
    id: broadcastGptId,
    channelId: chId,
    role: "assistant",
    modelId: "gpt-5",
    authorPaneId: p2,
    content:
      "1. Position the brand as the anti-algorithm — manufacture scarcity through unannounced drops at real skate spots.\n2. Lean into nostalgia-by-proxy: hire Gen Z designers to reinterpret 90s graphics, not reissue them.\n3. Make community the product — sell a $20/year membership that gates access to a roving popup, repair tour, and rider crew.",
  };

  // Mirror channel entries into each pane's messages with channelId attribution
  const channelMsgs = (): PaneMessage[] => [
    { id: broadcastUserId, role: "user", content: broadcastUser.content, channelId: chId },
    { id: broadcastClaudeId, role: "assistant", modelId: claudeReply.modelId, content: claudeReply.content, channelId: chId, authorPaneId: p1 },
    { id: broadcastGptId, role: "assistant", modelId: gptReply.modelId, content: gptReply.content, channelId: chId, authorPaneId: p2 },
  ];

  const panes: Record<string, Pane> = {
    [p1]: {
      id: p1,
      modelId: "claude-opus-4",
      channelId: chId,
      messages: channelMsgs(),
    },
    [p2]: {
      id: p2,
      modelId: "gpt-5",
      channelId: chId,
      messages: channelMsgs(),
    },
    [p3]: {
      id: p3,
      modelId: "gemini-2.5-pro",
      channelId: null,
      messages: [],
    },
    [p4]: {
      id: p4,
      modelId: "deepseek-v3",
      channelId: null,
      messages: [],
    },
  };

  const layout: LayoutNode = {
    type: "split",
    id: uid("split"),
    direction: "vertical", // top row + bottom row
    ratio: 0.5,
    a: {
      type: "split",
      id: uid("split"),
      direction: "horizontal",
      ratio: 0.5,
      a: { type: "leaf", id: uid("leaf"), paneId: p1 },
      b: { type: "leaf", id: uid("leaf"), paneId: p2 },
    },
    b: {
      type: "split",
      id: uid("split"),
      direction: "horizontal",
      ratio: 0.5,
      a: { type: "leaf", id: uid("leaf"), paneId: p3 },
      b: { type: "leaf", id: uid("leaf"), paneId: p4 },
    },
  };

  return {
    panes,
    channels: [brainstorm],
    channelMessages: {
      [chId]: [broadcastUser, claudeReply, gptReply],
    },
    layout,
    activePaneId: p1,
  };
}

// ---------- Presets ----------
export type PresetKey = "single" | "2x1" | "1x2" | "2x2" | "3-column" | "editor-sidebar";

const DEFAULT_MODELS = ["claude-opus-4", "gpt-5", "gemini-2.5-pro", "deepseek-v3", "claude-sonnet-4", "llama-4"];

function buildPreset(preset: PresetKey): { layout: LayoutNode; panes: Record<string, Pane> } {
  const makePane = (i: number): Pane => ({
    id: `pane-${uid()}`,
    modelId: DEFAULT_MODELS[i % DEFAULT_MODELS.length],
    channelId: null,
    messages: [],
  });
  const leaf = (paneId: string): LeafNode => ({ type: "leaf", id: uid("leaf"), paneId });
  const split = (
    direction: "horizontal" | "vertical",
    a: LayoutNode,
    b: LayoutNode,
    ratio = 0.5,
  ): SplitNode => ({ type: "split", id: uid("split"), direction, ratio, a, b });

  if (preset === "single") {
    const p = makePane(0);
    return { panes: { [p.id]: p }, layout: leaf(p.id) };
  }
  if (preset === "2x1") {
    const [a, b] = [makePane(0), makePane(1)];
    return { panes: { [a.id]: a, [b.id]: b }, layout: split("horizontal", leaf(a.id), leaf(b.id)) };
  }
  if (preset === "1x2") {
    const [a, b] = [makePane(0), makePane(1)];
    return { panes: { [a.id]: a, [b.id]: b }, layout: split("vertical", leaf(a.id), leaf(b.id)) };
  }
  if (preset === "2x2") {
    const [a, b, c, d] = [makePane(0), makePane(1), makePane(2), makePane(3)];
    return {
      panes: { [a.id]: a, [b.id]: b, [c.id]: c, [d.id]: d },
      layout: split(
        "vertical",
        split("horizontal", leaf(a.id), leaf(b.id)),
        split("horizontal", leaf(c.id), leaf(d.id)),
      ),
    };
  }
  if (preset === "3-column") {
    const [a, b, c] = [makePane(0), makePane(1), makePane(2)];
    return {
      panes: { [a.id]: a, [b.id]: b, [c.id]: c },
      layout: split("horizontal", leaf(a.id), split("horizontal", leaf(b.id), leaf(c.id), 0.5), 0.333),
    };
  }
  // editor-sidebar: big left, two stacked right
  const [a, b, c] = [makePane(0), makePane(1), makePane(2)];
  return {
    panes: { [a.id]: a, [b.id]: b, [c.id]: c },
    layout: split("horizontal", leaf(a.id), split("vertical", leaf(b.id), leaf(c.id), 0.5), 0.62),
  };
}

// ---------- Provider ----------
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(() => buildInitialState());

  const setActivePane = useCallback((paneId: string) => {
    setState((s) => ({ ...s, activePaneId: paneId }));
  }, []);

  const splitPane = useCallback((paneId: string, direction: "horizontal" | "vertical") => {
    setState((s) => {
      const existing = s.panes[paneId];
      if (!existing) return s;
      const newPane: Pane = {
        id: `pane-${uid()}`,
        // Default new pane to next model in list, fallback to existing model
        modelId: DEFAULT_MODELS.find((m) => m !== existing.modelId) ?? existing.modelId,
        channelId: null,
        messages: [],
      };
      const newLayout = replaceLeaf(s.layout, paneId, (leaf) => ({
        type: "split",
        id: uid("split"),
        direction,
        ratio: 0.5,
        a: leaf,
        b: { type: "leaf", id: uid("leaf"), paneId: newPane.id },
      }));
      return {
        ...s,
        panes: { ...s.panes, [newPane.id]: newPane },
        layout: newLayout,
        activePaneId: newPane.id,
      };
    });
  }, []);

  const closePane = useCallback((paneId: string) => {
    setState((s) => {
      const newLayout = removeLeaf(s.layout, paneId);
      if (!newLayout) return s; // never let workspace become empty — keep current
      const newPanes = { ...s.panes };
      delete newPanes[paneId];
      const remaining = collectLeaves(newLayout);
      const activePaneId =
        s.activePaneId === paneId ? remaining[0]?.paneId ?? null : s.activePaneId;
      return { ...s, layout: newLayout, panes: newPanes, activePaneId };
    });
  }, []);

  const resetLayout = useCallback(() => {
    setState(() => buildInitialState());
  }, []);

  const applyPreset = useCallback((preset: PresetKey) => {
    setState((s) => {
      const { layout, panes } = buildPreset(preset);
      const firstPaneId = Object.keys(panes)[0] ?? null;
      // preserve channels and channelMessages
      return {
        ...s,
        layout,
        panes,
        activePaneId: firstPaneId,
      };
    });
  }, []);

  const setPaneModel = useCallback((paneId: string, modelId: string) => {
    setState((s) => ({
      ...s,
      panes: s.panes[paneId] ? { ...s.panes, [paneId]: { ...s.panes[paneId], modelId } } : s.panes,
    }));
  }, []);

  const setPaneChannel = useCallback((paneId: string, channelId: string | null) => {
    setState((s) => {
      const pane = s.panes[paneId];
      if (!pane) return s;
      // When joining a channel, copy channel history into the pane's message
      // list (if not already present) so it sees the shared context.
      let messages = pane.messages;
      if (channelId) {
        const channelEntries = s.channelMessages[channelId] ?? [];
        const existingChannelMsgIds = new Set(
          pane.messages.filter((m) => m.channelId === channelId).map((m) => m.id),
        );
        const newOnes: PaneMessage[] = channelEntries
          .filter((e) => !existingChannelMsgIds.has(e.id))
          .map((e) => ({
            id: e.id,
            role: e.role,
            content: e.content,
            modelId: e.modelId,
            channelId,
            authorPaneId: e.authorPaneId,
          }));
        messages = [...pane.messages, ...newOnes];
      }
      return {
        ...s,
        panes: { ...s.panes, [paneId]: { ...pane, channelId, messages } },
      };
    });
  }, []);

  const swapPanes = useCallback((a: string, b: string) => {
    if (a === b) return;
    setState((s) => {
      // Swap paneIds in the layout tree
      const swap = (n: LayoutNode): LayoutNode => {
        if (n.type === "leaf") {
          if (n.paneId === a) return { ...n, paneId: b };
          if (n.paneId === b) return { ...n, paneId: a };
          return n;
        }
        return { ...n, a: swap(n.a), b: swap(n.b) };
      };
      return { ...s, layout: swap(s.layout) };
    });
  }, []);

  const addPaneMessage = useCallback((paneId: string, msg: PaneMessage) => {
    setState((s) => {
      const pane = s.panes[paneId];
      if (!pane) return s;
      return { ...s, panes: { ...s.panes, [paneId]: { ...pane, messages: [...pane.messages, msg] } } };
    });
  }, []);

  const updatePaneMessage = useCallback(
    (paneId: string, msgId: string, patch: Partial<PaneMessage>) => {
      setState((s) => {
        const pane = s.panes[paneId];
        if (!pane) return s;
        return {
          ...s,
          panes: {
            ...s.panes,
            [paneId]: {
              ...pane,
              messages: pane.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
            },
          },
        };
      });
    },
    [],
  );

  const setPaneStreaming = useCallback((paneId: string, streaming: boolean) => {
    setState((s) => {
      const pane = s.panes[paneId];
      if (!pane) return s;
      return { ...s, panes: { ...s.panes, [paneId]: { ...pane, streaming } } };
    });
  }, []);

  const addChannelEntry = useCallback((channelId: string, entry: BroadcastEntry) => {
    setState((s) => {
      const current = s.channelMessages[channelId] ?? [];
      // Also mirror into every pane subscribed to this channel
      const newPanes = { ...s.panes };
      for (const pid of Object.keys(newPanes)) {
        const p = newPanes[pid];
        if (p.channelId === channelId) {
          // Skip if the message already exists
          if (p.messages.some((m) => m.id === entry.id)) continue;
          newPanes[pid] = {
            ...p,
            messages: [
              ...p.messages,
              {
                id: entry.id,
                role: entry.role,
                content: entry.content,
                modelId: entry.modelId,
                channelId,
                authorPaneId: entry.authorPaneId,
                streaming: entry.streaming,
              },
            ],
          };
        }
      }
      return {
        ...s,
        channelMessages: { ...s.channelMessages, [channelId]: [...current, entry] },
        panes: newPanes,
      };
    });
  }, []);

  const updateChannelEntry = useCallback(
    (channelId: string, entryId: string, patch: Partial<BroadcastEntry>) => {
      setState((s) => {
        const current = s.channelMessages[channelId] ?? [];
        const newEntries = current.map((e) => (e.id === entryId ? { ...e, ...patch } : e));
        // Also patch in every pane subscribed
        const newPanes = { ...s.panes };
        for (const pid of Object.keys(newPanes)) {
          const p = newPanes[pid];
          if (p.channelId !== channelId) continue;
          newPanes[pid] = {
            ...p,
            messages: p.messages.map((m) =>
              m.id === entryId
                ? {
                    ...m,
                    ...(patch.content !== undefined ? { content: patch.content } : {}),
                    ...(patch.streaming !== undefined ? { streaming: patch.streaming } : {}),
                  }
                : m,
            ),
          };
        }
        return { ...s, channelMessages: { ...s.channelMessages, [channelId]: newEntries }, panes: newPanes };
      });
    },
    [],
  );

  const createChannel = useCallback((name: string) => {
    const id = `channel-${uid()}`;
    setState((s) => {
      const usedColors = new Set(s.channels.map((c) => c.color));
      const color = CHANNEL_COLOR_ORDER.find((c) => !usedColors.has(c)) ?? "cyan";
      return {
        ...s,
        channels: [...s.channels, { id, name, color }],
        channelMessages: { ...s.channelMessages, [id]: [] },
      };
    });
    return id;
  }, []);

  const renameChannel = useCallback((channelId: string, name: string) => {
    setState((s) => ({
      ...s,
      channels: s.channels.map((c) => (c.id === channelId ? { ...c, name } : c)),
    }));
  }, []);

  const deleteChannel = useCallback((channelId: string) => {
    setState((s) => {
      const newChannelMessages = { ...s.channelMessages };
      delete newChannelMessages[channelId];
      const newPanes: Record<string, Pane> = {};
      for (const pid of Object.keys(s.panes)) {
        const p = s.panes[pid];
        newPanes[pid] = {
          ...p,
          channelId: p.channelId === channelId ? null : p.channelId,
          messages: p.messages.filter((m) => m.channelId !== channelId),
        };
      }
      return {
        ...s,
        channels: s.channels.filter((c) => c.id !== channelId),
        channelMessages: newChannelMessages,
        panes: newPanes,
      };
    });
  }, []);

  const branchPane = useCallback((paneId: string, untilMessageId: string, opts?: { newModelId?: string }): string | null => {
    let newPaneId: string | null = null;
    setState((s) => {
      const source = s.panes[paneId];
      if (!source) return s;
      const cutIdx = source.messages.findIndex((m) => m.id === untilMessageId);
      if (cutIdx < 0) return s;
      const slicedMessages = source.messages.slice(0, cutIdx + 1).map((m) => ({ ...m }));
      newPaneId = `pane-${uid()}`;
      const newPane: Pane = {
        id: newPaneId,
        modelId: opts?.newModelId ?? source.modelId,
        channelId: null, // branches start private
        messages: slicedMessages,
        branchedFrom: { paneId, messageId: untilMessageId },
      };
      // Place new pane to the right of the source
      const newLayout = replaceLeaf(s.layout, paneId, (leaf) => ({
        type: "split",
        id: uid("split"),
        direction: "horizontal",
        ratio: 0.5,
        a: leaf,
        b: { type: "leaf", id: uid("leaf"), paneId: newPaneId! },
      }));
      // mark the source message as having a branch
      const srcPanePatched: Pane = {
        ...source,
        messages: source.messages.map((m) =>
          m.id === untilMessageId
            ? { ...m, branchPaneIds: [...(m.branchPaneIds ?? []), newPaneId!] }
            : m,
        ),
      };
      return {
        ...s,
        panes: { ...s.panes, [paneId]: srcPanePatched, [newPaneId!]: newPane },
        layout: newLayout,
        activePaneId: newPaneId,
      };
    });
    return newPaneId;
  }, []);

  const addPaneMessageVariant = useCallback(
    (paneId: string, msgId: string, variant: { id: string; modelId: string; content: string; streaming?: boolean }) => {
      setState((s) => {
        const pane = s.panes[paneId];
        if (!pane) return s;
        return {
          ...s,
          panes: {
            ...s.panes,
            [paneId]: {
              ...pane,
              messages: pane.messages.map((m) => {
                if (m.id !== msgId) return m;
                const variants = [...(m.variants ?? []), variant];
                return { ...m, variants, activeVariant: variants.length - 1 };
              }),
            },
          },
        };
      });
    },
    [],
  );

  const updatePaneMessageVariant = useCallback(
    (paneId: string, msgId: string, variantId: string, patch: Partial<{ content: string; streaming: boolean; stopped: boolean }>) => {
      setState((s) => {
        const pane = s.panes[paneId];
        if (!pane) return s;
        return {
          ...s,
          panes: {
            ...s.panes,
            [paneId]: {
              ...pane,
              messages: pane.messages.map((m) => {
                if (m.id !== msgId || !m.variants) return m;
                return {
                  ...m,
                  variants: m.variants.map((v) => (v.id === variantId ? { ...v, ...patch } : v)),
                };
              }),
            },
          },
        };
      });
    },
    [],
  );

  const setActiveVariant = useCallback((paneId: string, msgId: string, variantIdx: number) => {
    setState((s) => {
      const pane = s.panes[paneId];
      if (!pane) return s;
      return {
        ...s,
        panes: {
          ...s.panes,
          [paneId]: {
            ...pane,
            messages: pane.messages.map((m) => (m.id === msgId ? { ...m, activeVariant: variantIdx } : m)),
          },
        },
      };
    });
  }, []);

  const setResizeRatio = useCallback((splitId: string, ratio: number) => {
    setState((s) => {
      const visit = (n: LayoutNode): LayoutNode => {
        if (n.type === "leaf") return n;
        if (n.id === splitId) return { ...n, ratio, a: visit(n.a), b: visit(n.b) };
        return { ...n, a: visit(n.a), b: visit(n.b) };
      };
      return { ...s, layout: visit(s.layout) };
    });
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ...state,
      setActivePane,
      splitPane,
      closePane,
      resetLayout,
      applyPreset,
      setPaneModel,
      setPaneChannel,
      swapPanes,
      addPaneMessage,
      updatePaneMessage,
      setPaneStreaming,
      addChannelEntry,
      updateChannelEntry,
      createChannel,
      renameChannel,
      deleteChannel,
      setResizeRatio,
      branchPane,
      addPaneMessageVariant,
      updatePaneMessageVariant,
      setActiveVariant,
    }),
    [
      state,
      setActivePane,
      splitPane,
      closePane,
      resetLayout,
      applyPreset,
      setPaneModel,
      setPaneChannel,
      swapPanes,
      addPaneMessage,
      updatePaneMessage,
      setPaneStreaming,
      addChannelEntry,
      updateChannelEntry,
      createChannel,
      renameChannel,
      deleteChannel,
      setResizeRatio,
      branchPane,
      addPaneMessageVariant,
      updatePaneMessageVariant,
      setActiveVariant,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

export function useChannel(channelId: string | null | undefined): Channel | undefined {
  const { channels } = useWorkspace();
  if (!channelId) return undefined;
  return channels.find((c) => c.id === channelId);
}

// Collect all pane leaves in order (left-to-right, top-to-bottom)
export function flattenLeaves(node: LayoutNode): string[] {
  if (node.type === "leaf") return [node.paneId];
  return [...flattenLeaves(node.a), ...flattenLeaves(node.b)];
}
