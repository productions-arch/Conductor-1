export type Provider = "openai" | "anthropic" | "google" | "meta" | "xai" | "deepseek";

export interface Model {
  id: string;
  name: string;
  provider: Provider;
  providerName: string;
  description: string;
}

export const MODELS: Model[] = [
  { id: "gpt-5", name: "GPT-5", provider: "openai", providerName: "OpenAI", description: "Reasoning and broad capability" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai", providerName: "OpenAI", description: "Fast, multimodal" },
  { id: "claude-opus-4", name: "Claude Opus 4", provider: "anthropic", providerName: "Anthropic", description: "Deep reasoning, long context" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", provider: "anthropic", providerName: "Anthropic", description: "Balanced, fast" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google", providerName: "Google", description: "Research, large context" },
  { id: "llama-4", name: "Llama 4", provider: "meta", providerName: "Meta", description: "Open-weights flagship" },
  { id: "deepseek-v3", name: "DeepSeek V3", provider: "deepseek", providerName: "DeepSeek", description: "Cost-efficient reasoning" },
  { id: "grok-3", name: "Grok 3", provider: "xai", providerName: "xAI", description: "Real-time and contrarian" },
];

export function modelById(id: string): Model {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function providerClass(provider: Provider): string {
  return `provider-${provider}`;
}
