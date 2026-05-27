/**
 * Map Conductor model IDs to OpenRouter model slugs + per-million-token pricing
 * snapshots. Pricing is best-effort static — server normalizes against
 * OpenRouter's `/models` endpoint at request time when available.
 */

export interface OpenRouterModelMeta {
  /** OpenRouter slug — used in the API request body */
  slug: string;
  /** USD per 1M prompt tokens (snapshot) */
  inputPerMTok: number;
  /** USD per 1M completion tokens (snapshot) */
  outputPerMTok: number;
}

export const OPENROUTER_MODELS: Record<string, OpenRouterModelMeta> = {
  "gpt-5": { slug: "openai/gpt-5", inputPerMTok: 5, outputPerMTok: 15 },
  "gpt-4o": { slug: "openai/gpt-4o", inputPerMTok: 2.5, outputPerMTok: 10 },
  "claude-opus-4": { slug: "anthropic/claude-opus-4", inputPerMTok: 15, outputPerMTok: 75 },
  "claude-sonnet-4": { slug: "anthropic/claude-sonnet-4", inputPerMTok: 3, outputPerMTok: 15 },
  "gemini-2.5-pro": { slug: "google/gemini-2.5-pro", inputPerMTok: 1.25, outputPerMTok: 10 },
  "llama-4": { slug: "meta-llama/llama-4", inputPerMTok: 0.5, outputPerMTok: 1.5 },
  "deepseek-v3": { slug: "deepseek/deepseek-chat-v3", inputPerMTok: 0.27, outputPerMTok: 1.1 },
  "grok-3": { slug: "x-ai/grok-3", inputPerMTok: 5, outputPerMTok: 15 },
};

export function openRouterSlug(modelId: string): string | null {
  return OPENROUTER_MODELS[modelId]?.slug ?? null;
}

export function priceFor(modelId: string): OpenRouterModelMeta | null {
  return OPENROUTER_MODELS[modelId] ?? null;
}

/**
 * Cost in USD for a given model + token counts.
 * Returns 0 if unknown.
 */
export function computeCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const m = priceFor(modelId);
  if (!m) return 0;
  return (
    (promptTokens / 1_000_000) * m.inputPerMTok +
    (completionTokens / 1_000_000) * m.outputPerMTok
  );
}

/**
 * Rough character-count → token estimate used for UI pre-send cost previews.
 * ~4 chars per token; round up.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
