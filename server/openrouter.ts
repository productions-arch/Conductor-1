/**
 * OpenRouter streaming proxy + key management.
 *
 * - /api/chat/stream — POST { modelId, messages } → SSE-style streamed text
 *   chunks. Reads the user's encrypted key from Postgres, decrypts in memory,
 *   forwards to OpenRouter with stream=true, parses upstream SSE, and writes
 *   plain text "data: <delta>\n\n" chunks back. Final usage line emits
 *   `event: usage\ndata: {...}\n\n` then `event: done\ndata: \n\n`.
 *
 * - /api/keys — GET (status), POST (set), DELETE (rotate)
 * - /api/keys/test — POST (validate a key with OpenRouter /auth/key)
 * - /api/usage — GET (aggregates) for the Usage page
 * - /api/feedback — POST (thumbs / general / bug report)
 */
import type { Request, Response } from "express";
import { and, desc, eq, gte, sql as drizzleSql } from "drizzle-orm";
import { db } from "./db";
import { encrypt, decrypt, lastFour } from "./crypto";
import { readSessionFromReq } from "./auth";
import {
  userApiKeys,
  usageEvents,
  users,
  feedback,
  insertFeedbackSchema,
} from "../shared/schema";
import {
  openRouterSlug,
  OPENROUTER_MODELS,
  computeCost,
} from "../shared/openrouter-models";

// ───── Key management ─────────────────────────────────────────────────

export async function getKeyStatus(req: Request, res: Response) {
  const session = readSessionFromReq(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  if (!db) return res.status(503).json({ error: "db_unavailable" });
  const rows = await db
    .select()
    .from(userApiKeys)
    .where(and(eq(userApiKeys.userId, session.uid), eq(userApiKeys.provider, "openrouter")))
    .limit(1);
  if (!rows.length) return res.json({ hasKey: false });
  return res.json({ hasKey: true, lastFour: rows[0].lastFour, createdAt: rows[0].createdAt });
}

export async function setKey(req: Request, res: Response) {
  const session = readSessionFromReq(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  if (!db) return res.status(503).json({ error: "db_unavailable" });
  const { key } = (req.body ?? {}) as { key?: string };
  if (!key || typeof key !== "string" || !key.startsWith("sk-or-")) {
    return res.status(400).json({ error: "invalid_key_format" });
  }
  const enc = encrypt(key);
  // Delete existing, insert new (idempotent rotate)
  await db
    .delete(userApiKeys)
    .where(and(eq(userApiKeys.userId, session.uid), eq(userApiKeys.provider, "openrouter")));
  await db.insert(userApiKeys).values({
    userId: session.uid,
    provider: "openrouter",
    encryptedKey: enc,
    lastFour: lastFour(key),
  });
  return res.json({ ok: true, lastFour: lastFour(key) });
}

export async function deleteKey(req: Request, res: Response) {
  const session = readSessionFromReq(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  if (!db) return res.status(503).json({ error: "db_unavailable" });
  await db
    .delete(userApiKeys)
    .where(and(eq(userApiKeys.userId, session.uid), eq(userApiKeys.provider, "openrouter")));
  return res.json({ ok: true });
}

export async function testKey(req: Request, res: Response) {
  const session = readSessionFromReq(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  const { key } = (req.body ?? {}) as { key?: string };
  if (!key) return res.status(400).json({ error: "missing_key" });
  try {
    const r = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      return res.status(200).json({ valid: false, status: r.status });
    }
    const data = (await r.json()) as any;
    return res.json({ valid: true, data });
  } catch (e: any) {
    return res.json({ valid: false, error: e?.message ?? "network" });
  }
}

async function loadUserKey(userId: string): Promise<string | null> {
  if (!db) return null;
  const rows = await db
    .select()
    .from(userApiKeys)
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, "openrouter")))
    .limit(1);
  if (!rows.length) return null;
  try {
    return decrypt(rows[0].encryptedKey);
  } catch (err) {
    console.error("decrypt failed", err);
    return null;
  }
}

// ───── /me ────────────────────────────────────────────────────────────

export async function me(req: Request, res: Response) {
  const session = readSessionFromReq(req);
  if (!session) return res.json({ user: null });
  if (!db) return res.json({ user: { id: session.uid, email: session.email, name: session.name, image: session.image } });
  const rows = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  if (!rows.length) return res.json({ user: null });
  const u = rows[0];
  // Also report key + today's spend so the nav chip can render immediately.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todaySpendRows = await db
    .select({ total: drizzleSql<number>`COALESCE(SUM(${usageEvents.costUsd}), 0)` })
    .from(usageEvents)
    .where(and(eq(usageEvents.userId, u.id), gte(usageEvents.createdAt, todayStart)));
  const keyRows = await db
    .select()
    .from(userApiKeys)
    .where(and(eq(userApiKeys.userId, u.id), eq(userApiKeys.provider, "openrouter")))
    .limit(1);
  return res.json({
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      image: u.image,
      provider: u.provider,
      dailySpendCapUsd: u.dailySpendCapUsd,
    },
    hasKey: keyRows.length > 0,
    keyLastFour: keyRows[0]?.lastFour ?? null,
    todaySpendUsd: Number(todaySpendRows[0]?.total ?? 0),
  });
}

export async function updateMe(req: Request, res: Response) {
  const session = readSessionFromReq(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  if (!db) return res.status(503).json({ error: "db_unavailable" });
  const { dailySpendCapUsd } = (req.body ?? {}) as { dailySpendCapUsd?: number };
  if (typeof dailySpendCapUsd === "number" && dailySpendCapUsd >= 0 && dailySpendCapUsd <= 1000) {
    await db.update(users).set({ dailySpendCapUsd, updatedAt: new Date() }).where(eq(users.id, session.uid));
  }
  return res.json({ ok: true });
}

// ───── Usage ──────────────────────────────────────────────────────────

export async function getUsage(req: Request, res: Response) {
  const session = readSessionFromReq(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  if (!db) return res.status(503).json({ error: "db_unavailable" });
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [today, month, byModel, daily] = await Promise.all([
    db
      .select({ total: drizzleSql<number>`COALESCE(SUM(${usageEvents.costUsd}), 0)` })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, session.uid), gte(usageEvents.createdAt, todayStart))),
    db
      .select({ total: drizzleSql<number>`COALESCE(SUM(${usageEvents.costUsd}), 0)` })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, session.uid), gte(usageEvents.createdAt, monthStart))),
    db
      .select({
        modelId: usageEvents.modelId,
        cost: drizzleSql<number>`COALESCE(SUM(${usageEvents.costUsd}), 0)`,
        promptTokens: drizzleSql<number>`COALESCE(SUM(${usageEvents.promptTokens}), 0)`,
        completionTokens: drizzleSql<number>`COALESCE(SUM(${usageEvents.completionTokens}), 0)`,
        count: drizzleSql<number>`COUNT(*)`,
      })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, session.uid), gte(usageEvents.createdAt, monthStart)))
      .groupBy(usageEvents.modelId),
    db
      .select({
        day: drizzleSql<string>`TO_CHAR(${usageEvents.createdAt}, 'YYYY-MM-DD')`,
        cost: drizzleSql<number>`COALESCE(SUM(${usageEvents.costUsd}), 0)`,
      })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, session.uid), gte(usageEvents.createdAt, thirtyAgo)))
      .groupBy(drizzleSql`TO_CHAR(${usageEvents.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(drizzleSql`TO_CHAR(${usageEvents.createdAt}, 'YYYY-MM-DD')`),
  ]);

  return res.json({
    today: Number(today[0]?.total ?? 0),
    month: Number(month[0]?.total ?? 0),
    byModel: byModel.map((r) => ({
      modelId: r.modelId,
      cost: Number(r.cost),
      promptTokens: Number(r.promptTokens),
      completionTokens: Number(r.completionTokens),
      count: Number(r.count),
    })),
    daily: daily.map((d) => ({ day: d.day, cost: Number(d.cost) })),
  });
}

// ───── Feedback ───────────────────────────────────────────────────────

export async function postFeedback(req: Request, res: Response) {
  const session = readSessionFromReq(req);
  if (!db) return res.status(503).json({ error: "db_unavailable" });
  const body = req.body ?? {};
  const parse = insertFeedbackSchema.safeParse({
    ...body,
    userId: session?.uid ?? null,
  });
  if (!parse.success) {
    return res.status(400).json({ error: "invalid", details: parse.error.flatten() });
  }
  await db.insert(feedback).values(parse.data);
  return res.json({ ok: true });
}

// ───── Streaming proxy ────────────────────────────────────────────────

/**
 * POST /api/chat/stream
 * Body: { modelId: string, messages: Array<{role,content}>, threadId?, messageId? }
 *
 * Reads the encrypted OpenRouter key for the authenticated user. Streams
 * chat completions back as plain "data: <delta>" chunks. Honors client
 * disconnect by aborting the upstream fetch.
 */
export async function streamChat(req: Request, res: Response) {
  const session = readSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (!db) {
    res.status(503).json({ error: "db_unavailable" });
    return;
  }

  const { modelId, messages, threadId, messageId } = (req.body ?? {}) as {
    modelId?: string;
    messages?: Array<{ role: string; content: string }>;
    threadId?: string;
    messageId?: string;
  };
  if (!modelId || !messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "bad_request" });
    return;
  }
  const slug = openRouterSlug(modelId);
  if (!slug) {
    res.status(400).json({ error: "unknown_model", modelId });
    return;
  }

  // Daily spend cap check
  const userRow = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  const cap = userRow[0]?.dailySpendCapUsd ?? 5;
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const spendRow = await db
    .select({ total: drizzleSql<number>`COALESCE(SUM(${usageEvents.costUsd}), 0)` })
    .from(usageEvents)
    .where(and(eq(usageEvents.userId, session.uid), gte(usageEvents.createdAt, todayStart)));
  const todaySpend = Number(spendRow[0]?.total ?? 0);
  if (todaySpend >= cap) {
    res.status(402).json({
      error: "daily_cap_exceeded",
      capUsd: cap,
      todaySpendUsd: todaySpend,
      message: `You have hit your daily spend cap of $${cap.toFixed(2)}. Raise it in Settings → Usage.`,
    });
    return;
  }

  const key = await loadUserKey(session.uid);
  if (!key) {
    res.status(412).json({
      error: "no_key",
      message: "Add your OpenRouter API key in Settings to use real models.",
    });
    return;
  }

  // SSE response setup
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const controller = new AbortController();
  // Client disconnect → abort upstream
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  let upstream: Response | null = null;
  let totalDelta = "";
  let promptTokens = 0;
  let completionTokens = 0;

  try {
    const upstreamResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.PUBLIC_BASE_URL ?? "https://conductor.app",
        "X-Title": "Conductor",
      },
      body: JSON.stringify({
        model: slug,
        messages,
        stream: true,
        usage: { include: true },
      }),
      signal: controller.signal,
    });

    if (!upstreamResp.ok || !upstreamResp.body) {
      const t = await upstreamResp.text().catch(() => "");
      const code =
        upstreamResp.status === 401
          ? "invalid_key"
          : upstreamResp.status === 429
            ? "rate_limited"
            : upstreamResp.status === 404
              ? "model_unavailable"
              : "upstream_error";
      writeEvent(res, "error", { code, status: upstreamResp.status, detail: t.slice(0, 500) });
      writeEvent(res, "done", {});
      res.end();
      return;
    }

    const reader = upstreamResp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Stream loop
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sepIdx: number;
      // OpenRouter SSE events are separated by \n\n
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        for (const line of rawEvent.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          if (payload.startsWith(":")) continue; // SSE comment / keepalive
          try {
            const obj = JSON.parse(payload);
            const delta = obj?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length) {
              totalDelta += delta;
              writeEvent(res, "delta", { c: delta });
            }
            if (obj?.usage) {
              promptTokens = obj.usage.prompt_tokens ?? promptTokens;
              completionTokens = obj.usage.completion_tokens ?? completionTokens;
            }
          } catch {
            // skip non-JSON lines
          }
        }
      }
    }

    // Record usage event
    const cost = computeCost(modelId, promptTokens, completionTokens);
    try {
      await db.insert(usageEvents).values({
        userId: session.uid,
        threadId: threadId ?? null,
        messageId: messageId ?? null,
        modelId,
        openrouterModel: slug,
        promptTokens,
        completionTokens,
        costUsd: cost,
      });
    } catch (e) {
      console.error("failed to write usage event", e);
    }
    writeEvent(res, "usage", { promptTokens, completionTokens, costUsd: cost });
    writeEvent(res, "done", {});
    res.end();
  } catch (err: any) {
    if (controller.signal.aborted) {
      // Client cancelled — best-effort log partial usage
      try {
        writeEvent(res, "aborted", {});
      } catch {/* socket may be closed */}
      try { res.end(); } catch {/* ignore */}
      return;
    }
    console.error("streamChat error", err);
    try {
      writeEvent(res, "error", { code: "network", detail: err?.message ?? "unknown" });
      writeEvent(res, "done", {});
      res.end();
    } catch {/* ignore */}
  }
}

function writeEvent(res: Response, event: string, data: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  // @ts-ignore — flush exists when compression is off
  (res as any).flush?.();
}
