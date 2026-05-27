/**
 * chat-store — multi-thread chat state with branching + variant tracking.
 *
 * Internally threads are stored flat (parent pointer per message); branching
 * forks the thread at a chosen assistant message into a new thread, prefixed
 * by the same messages up to (and including) that point. Each assistant
 * message can carry an array of `variants` (used by retry-with-different-model).
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string;
  streaming?: boolean;
  stopped?: boolean;
  parentId?: string;
  /** Sibling assistant responses (retry-with-different-model). idx -1 = the original. */
  variants?: Array<{ id: string; modelId: string; content: string; streaming?: boolean; stopped?: boolean }>;
  activeVariant?: number;
  /** Branched-from-this-message thread IDs */
  branchThreadIds?: string[];
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMsg[];
  branchedFrom?: { threadId: string; messageId: string };
}

interface ChatStoreState {
  threads: Record<string, ChatThread>;
  activeThreadId: string;
}

interface ChatStoreActions {
  setActiveThread: (id: string) => void;
  addMessage: (threadId: string, msg: ChatMsg) => void;
  updateMessage: (threadId: string, msgId: string, patch: Partial<ChatMsg>) => void;
  branchThread: (threadId: string, untilMessageId: string) => string | null;
  addVariant: (threadId: string, msgId: string, variant: { id: string; modelId: string; content: string; streaming?: boolean }) => void;
  updateVariant: (threadId: string, msgId: string, variantId: string, patch: Partial<{ content: string; streaming: boolean; stopped: boolean }>) => void;
  setActiveVariant: (threadId: string, msgId: string, idx: number) => void;
}

type ChatContextValue = ChatStoreState & ChatStoreActions;

const ChatContext = createContext<ChatContextValue | null>(null);

const INITIAL_THREAD_ID = "thread-main";

function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const INITIAL_MESSAGES: ChatMsg[] = [
  {
    id: "m0",
    role: "assistant",
    modelId: "claude-opus-4",
    content:
      "Welcome to Conductor. Pick a model from the dropdown next to send, type a prompt, and switch between models freely \u2014 they all share the conversation context. Try the Compare or Orchestrate tabs above for multi-model workflows.",
  },
];

export function ChatStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ChatStoreState>({
    threads: {
      [INITIAL_THREAD_ID]: {
        id: INITIAL_THREAD_ID,
        title: "Untitled thread",
        messages: INITIAL_MESSAGES,
      },
    },
    activeThreadId: INITIAL_THREAD_ID,
  });

  const setActiveThread = useCallback((id: string) => {
    setState((s) => (s.threads[id] ? { ...s, activeThreadId: id } : s));
  }, []);

  const addMessage = useCallback((threadId: string, msg: ChatMsg) => {
    setState((s) => {
      const t = s.threads[threadId];
      if (!t) return s;
      return {
        ...s,
        threads: { ...s.threads, [threadId]: { ...t, messages: [...t.messages, msg] } },
      };
    });
  }, []);

  const updateMessage = useCallback((threadId: string, msgId: string, patch: Partial<ChatMsg>) => {
    setState((s) => {
      const t = s.threads[threadId];
      if (!t) return s;
      return {
        ...s,
        threads: {
          ...s.threads,
          [threadId]: {
            ...t,
            messages: t.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
          },
        },
      };
    });
  }, []);

  const branchThread = useCallback((threadId: string, untilMessageId: string): string | null => {
    let newId: string | null = null;
    setState((s) => {
      const t = s.threads[threadId];
      if (!t) return s;
      const cut = t.messages.findIndex((m) => m.id === untilMessageId);
      if (cut < 0) return s;
      newId = `thread-${uid()}`;
      const sliced = t.messages.slice(0, cut + 1).map((m) => ({ ...m }));
      const newThread: ChatThread = {
        id: newId,
        title: `${t.title} \u2022 branch`,
        messages: sliced,
        branchedFrom: { threadId, messageId: untilMessageId },
      };
      const patchedSource: ChatThread = {
        ...t,
        messages: t.messages.map((m) =>
          m.id === untilMessageId
            ? { ...m, branchThreadIds: [...(m.branchThreadIds ?? []), newId!] }
            : m,
        ),
      };
      return {
        ...s,
        threads: { ...s.threads, [threadId]: patchedSource, [newId!]: newThread },
        activeThreadId: newId,
      };
    });
    return newId;
  }, []);

  const addVariant = useCallback(
    (threadId: string, msgId: string, variant: { id: string; modelId: string; content: string; streaming?: boolean }) => {
      setState((s) => {
        const t = s.threads[threadId];
        if (!t) return s;
        return {
          ...s,
          threads: {
            ...s.threads,
            [threadId]: {
              ...t,
              messages: t.messages.map((m) => {
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

  const updateVariant = useCallback(
    (threadId: string, msgId: string, variantId: string, patch: Partial<{ content: string; streaming: boolean; stopped: boolean }>) => {
      setState((s) => {
        const t = s.threads[threadId];
        if (!t) return s;
        return {
          ...s,
          threads: {
            ...s.threads,
            [threadId]: {
              ...t,
              messages: t.messages.map((m) => {
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

  const setVariantIdx = useCallback((threadId: string, msgId: string, idx: number) => {
    setState((s) => {
      const t = s.threads[threadId];
      if (!t) return s;
      return {
        ...s,
        threads: {
          ...s.threads,
          [threadId]: {
            ...t,
            messages: t.messages.map((m) => (m.id === msgId ? { ...m, activeVariant: idx } : m)),
          },
        },
      };
    });
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      ...state,
      setActiveThread,
      addMessage,
      updateMessage,
      branchThread,
      addVariant,
      updateVariant,
      setActiveVariant: setVariantIdx,
    }),
    [state, setActiveThread, addMessage, updateMessage, branchThread, addVariant, updateVariant, setVariantIdx],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatStore(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatStore must be inside ChatStoreProvider");
  return ctx;
}
