/**
 * AI Gateway — abstraction layer for streaming completions.
 *
 * Two paths, decided at call time by `getMode()`:
 *   - "mock" — local, character-by-character mock stream (used logged-out and
 *     for exploration). Fully self-contained, no network. Honors AbortSignal.
 *   - "live" — POST to /api/chat/stream which proxies OpenRouter using the
 *     authenticated user's encrypted BYOK key. Parses our custom SSE events
 *     and yields delta chunks.
 *
 * The store decides mode via `setGatewayMode("mock" | "live")`. Components
 * consume `getGatewayMode()` to render the DEMO MODE badge.
 */

import { mockResponse } from "./mock-responses";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  modelId?: string;
}

export interface StreamOptions {
  signal?: AbortSignal;
  /** Override the mocked response text (used by workflow nodes) */
  responseOverride?: string;
  /** Speed in milliseconds per chunk (default depends on model cadence) */
  chunkDelay?: number;
  /** Force a length bucket: short | medium | long. Random by default. */
  lengthHint?: "short" | "medium" | "long";
  /** Pass-through metadata for the server (threadId / messageId) */
  threadId?: string;
  messageId?: string;
  /** Hook for usage events surfaced from /api/chat/stream */
  onUsage?: (usage: {
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
  }) => void;
  /** Hook for explicit error events from the server */
  onError?: (err: { code: string; status?: number; detail?: string }) => void;
}

export type GatewayMode = "mock" | "live";

// ── Gateway mode (global; mutated by the auth/key state) ────────────────
let CURRENT_MODE: GatewayMode = "mock";
const listeners = new Set<(m: GatewayMode) => void>();

export function getGatewayMode(): GatewayMode {
  return CURRENT_MODE;
}
export function setGatewayMode(m: GatewayMode) {
  if (CURRENT_MODE !== m) {
    CURRENT_MODE = m;
    listeners.forEach((l) => l(m));
  }
}
export function subscribeGatewayMode(fn: (m: GatewayMode) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export class GatewayError extends Error {
  code: string;
  status?: number;
  detail?: string;
  constructor(code: string, message: string, status?: number, detail?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

// Per-model cadence — used by the mock path
const MODEL_CADENCE: Record<string, { base: number; jitter: number }> = {
  "gemini-2.5-pro": { base: 55, jitter: 50 },
  "gpt-4o": { base: 70, jitter: 80 },
  "gpt-5": { base: 110, jitter: 120 },
  "claude-sonnet-4": { base: 95, jitter: 100 },
  "claude-opus-4": { base: 160, jitter: 140 },
  "deepseek-v3": { base: 100, jitter: 90 },
  "llama-4": { base: 80, jitter: 90 },
  "grok-3": { base: 90, jitter: 100 },
};
function cadenceFor(modelId: string) {
  return MODEL_CADENCE[modelId] ?? { base: 100, jitter: 120 };
}

// ─────────────────────────────────────────────────────────────────────
// MOCK PATH
// ─────────────────────────────────────────────────────────────────────
async function* streamCompletionMock(
  modelId: string,
  messages: ChatMessage[],
  options: StreamOptions,
): AsyncGenerator<string, void, unknown> {
  const { signal, responseOverride, chunkDelay, lengthHint } = options;
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userText = lastUser?.content ?? "";
  let text = responseOverride ?? mockResponse(modelId, userText);

  if (!responseOverride) {
    const bucket =
      lengthHint ??
      (Math.random() < 0.25 ? "short" : Math.random() < 0.66 ? "medium" : "long");
    if (bucket === "short") {
      const cut = Math.min(text.length, 60 + Math.floor(Math.random() * 120));
      text = text.slice(0, cut).split(/[.!?]/)[0] + ".";
    } else if (bucket === "medium") {
      const cut = Math.min(text.length, 320 + Math.floor(Math.random() * 240));
      text = text.slice(0, cut);
    } else {
      if (text.length < 600) {
        text =
          text +
          "\n\nGoing a layer deeper: the same logic compounds across the longer arc. Each commit reduces optionality elsewhere, so the sequencing matters more than any individual call. What looks like indecision early is often correct — the cost of being wrong scales fast once choices are locked in.";
      }
    }
  }

  const cadence = cadenceFor(modelId);
  const base = chunkDelay ?? cadence.base;

  let i = 0;
  while (i < text.length) {
    if (signal?.aborted) return;
    const chunkSize = Math.min(text.length - i, 2 + Math.floor(Math.random() * 4));
    const chunk = text.slice(i, i + chunkSize);
    yield chunk;
    i += chunkSize;
    await waitOrAbort(base + Math.random() * cadence.jitter, signal);
  }
}

function waitOrAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      signal.addEventListener("abort", onAbort);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────
// LIVE PATH (OpenRouter via /api/chat/stream)
// ─────────────────────────────────────────────────────────────────────
async function* streamCompletionLive(
  modelId: string,
  messages: ChatMessage[],
  options: StreamOptions,
): AsyncGenerator<string, void, unknown> {
  const apiBase = (window as any).__API_BASE__ || "";
  const resp = await fetch(`${apiBase}/api/chat/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelId,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      threadId: options.threadId,
      messageId: options.messageId,
    }),
    signal: options.signal,
  });

  if (!resp.ok) {
    let detail = "";
    let body: any = null;
    try {
      body = await resp.json();
      detail = body?.message ?? body?.error ?? "";
    } catch { /* ignore */ }
    const code = body?.error ?? "http_error";
    const err = new GatewayError(code, friendlyError(code, resp.status, detail), resp.status, detail);
    options.onError?.({ code, status: resp.status, detail });
    throw err;
  }

  if (!resp.body) {
    throw new GatewayError("no_body", "No response body from server.");
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  // Parse our SSE: events separated by \n\n, lines `event:` and `data:`.
  // We yield strings for "delta" events; surface usage via callback; raise on "error".
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (options.signal?.aborted) return;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let event = "message";
      let data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed: any = {};
      try {
        parsed = JSON.parse(data);
      } catch { /* ignore */ }
      if (event === "delta" && typeof parsed.c === "string") {
        yield parsed.c;
      } else if (event === "usage") {
        options.onUsage?.({
          promptTokens: parsed.promptTokens ?? 0,
          completionTokens: parsed.completionTokens ?? 0,
          costUsd: parsed.costUsd ?? 0,
        });
      } else if (event === "error") {
        const code = parsed.code ?? "upstream_error";
        const err = new GatewayError(code, friendlyError(code, parsed.status, parsed.detail), parsed.status, parsed.detail);
        options.onError?.({ code, status: parsed.status, detail: parsed.detail });
        throw err;
      } else if (event === "done" || event === "aborted") {
        return;
      }
    }
  }
}

function friendlyError(code: string, status?: number, detail?: string): string {
  switch (code) {
    case "no_key":
      return "Add your OpenRouter key in Settings to send real prompts.";
    case "invalid_key":
      return "Your OpenRouter key was rejected. Replace it in Settings.";
    case "rate_limited":
      return "OpenRouter rate-limited this request. Try again in a few seconds.";
    case "model_unavailable":
      return "This model isn't available on OpenRouter right now. Try another.";
    case "daily_cap_exceeded":
      return "You've hit today's spend cap. Raise it in Settings → Usage.";
    case "unauthorized":
      return "Please sign in to use real models.";
    case "network":
      return "Network error reaching OpenRouter. Check your connection and retry.";
    default:
      return detail || `Something went wrong${status ? ` (${status})` : ""}.`;
  }
}

// ─────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────
export async function* streamCompletion(
  modelId: string,
  messages: ChatMessage[],
  options: StreamOptions = {},
): AsyncGenerator<string, void, unknown> {
  // Workflow nodes pass `responseOverride` to render fixed text deterministically;
  // we keep those on the mock path regardless of live mode.
  if (CURRENT_MODE === "mock" || options.responseOverride) {
    yield* streamCompletionMock(modelId, messages, options);
    return;
  }
  yield* streamCompletionLive(modelId, messages, options);
}

export async function runCompletion(
  modelId: string,
  messages: ChatMessage[],
  onChunk: (chunk: string, full: string) => void,
  options: StreamOptions = {},
): Promise<string> {
  let full = "";
  try {
    for await (const chunk of streamCompletion(modelId, messages, options)) {
      if (options.signal?.aborted) break;
      full += chunk;
      onChunk(chunk, full);
    }
  } catch (err) {
    if (err instanceof GatewayError) {
      // Surface the error text into the message so the user sees it inline.
      const msg = `⚠️ ${err.message}`;
      full = full ? `${full}\n\n${msg}` : msg;
      onChunk("", full);
    } else {
      throw err;
    }
  }
  return full;
}
