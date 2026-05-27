import type { ChatMessage } from "./ai-gateway";

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  updatedLabel: string;
  messages: ChatMessage[];
}

export interface SavedWorkflow {
  id: string;
  name: string;
  description: string;
  template: WorkflowTemplateId;
}

export type WorkflowTemplateId =
  | "draft-critique-refine"
  | "research-analyze-summarize"
  | "debate"
  | "translate-chain"
  | "custom";

export const EXAMPLE_CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    title: "Pricing tiers for a multi-agent SaaS",
    preview: "What's the right anchor price for the middle tier?",
    updatedLabel: "2h ago",
    messages: [
      { role: "user", content: "What's the right anchor price for the middle tier of a multi-agent SaaS aimed at knowledge workers?" },
      { role: "assistant", modelId: "claude-opus-4", content: "There are a few questions hiding inside that one. Let me separate them..." },
    ],
  },
  {
    id: "c2",
    title: "Why does feedback compound?",
    preview: "Trying to articulate the case for short loops.",
    updatedLabel: "Yesterday",
    messages: [
      { role: "user", content: "Why does feedback compound? I want a sharper way to articulate the case for short loops." },
      { role: "assistant", modelId: "gpt-5", content: "Three angles worth separating before answering..." },
    ],
  },
  {
    id: "c3",
    title: "Quarterly strategy memo — draft notes",
    preview: "Pulling together the Q3 narrative.",
    updatedLabel: "Mon",
    messages: [
      { role: "user", content: "Help me pull together the Q3 narrative. We hit the revenue target but missed retention." },
      { role: "assistant", modelId: "claude-sonnet-4", content: "A few things stand out..." },
    ],
  },
  {
    id: "c4",
    title: "Evaluating an acquisition offer",
    preview: "Cash vs. stock weighting and what the comps say.",
    updatedLabel: "Fri",
    messages: [
      { role: "user", content: "How should I weight the cash vs. stock component of an acquisition offer when the buyer is private?" },
      { role: "assistant", modelId: "gemini-2.5-pro", content: "Research summary..." },
    ],
  },
];

export const SAVED_WORKFLOWS: SavedWorkflow[] = [
  {
    id: "w1",
    name: "Memo draft → critique → polish",
    description: "Claude drafts, GPT-5 critiques, Claude polishes",
    template: "draft-critique-refine",
  },
  {
    id: "w2",
    name: "Market research → analysis",
    description: "Gemini researches, GPT-5 analyzes, Claude summarizes",
    template: "research-analyze-summarize",
  },
  {
    id: "w3",
    name: "Translate fidelity test",
    description: "Round-trip through three languages",
    template: "translate-chain",
  },
];
