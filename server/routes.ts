import type { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";

import { clearSessionCookie, readSessionFromReq, APPLE_ENABLED, GOOGLE_ENABLED } from "./auth";
import { googleSignIn, googleCallback } from "./oauth-google";
import { appleSignIn, appleCallback } from "./oauth-apple";
import { db } from "./db";
import { shareLinks } from "../shared/schema";
import {
  getKeyStatus,
  setKey,
  deleteKey,
  testKey,
  me,
  updateMe,
  getUsage,
  postFeedback,
  streamChat,
} from "./openrouter";

async function createShare(req: Request, res: Response) {
  const session = readSessionFromReq(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  if (!db) return res.status(503).json({ error: "db_unavailable" });
  const { title, mode, snapshot } = (req.body ?? {}) as {
    title?: string;
    mode?: string;
    snapshot?: unknown;
  };
  if (!snapshot || !mode) return res.status(400).json({ error: "missing_fields" });
  const token = randomBytes(18).toString("base64url");
  await db.insert(shareLinks).values({
    token,
    userId: session.uid,
    title: (typeof title === "string" && title.trim()) ? title.trim() : "Shared conversation",
    mode: mode as string,
    snapshotJson: snapshot as any,
  });
  return res.json({ token });
}

async function getShare(req: Request, res: Response) {
  if (!db) return res.status(503).json({ error: "db_unavailable" });
  const { token } = req.params as { token: string };
  const rows = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1);
  if (!rows.length) return res.status(404).json({ error: "not_found" });
  const link = rows[0];
  if (link.expiresAt && link.expiresAt < new Date()) {
    return res.status(410).json({ error: "expired" });
  }
  return res.json({
    title: link.title,
    mode: link.mode,
    snapshot: link.snapshotJson,
    createdAt: link.createdAt,
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // ── Health ────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      hasDb: !!process.env.DATABASE_URL,
      hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
      googleEnabled: GOOGLE_ENABLED,
      appleEnabled: APPLE_ENABLED,
      hasAuthSecret: !!process.env.AUTH_SECRET,
    });
  });

  // ── Auth ──────────────────────────────────────────────────────────
  app.get("/api/auth/providers", (_req, res) => {
    res.json({
      google: GOOGLE_ENABLED,
      apple: APPLE_ENABLED,
    });
  });

  app.get("/api/auth/signin/google", googleSignIn);
  app.get("/api/auth/callback/google", googleCallback);

  app.get("/api/auth/signin/apple", appleSignIn);
  // Apple posts back with form_post mode → accept both
  app.post("/api/auth/callback/apple", appleCallback);
  app.get("/api/auth/callback/apple", appleCallback);

  app.post("/api/auth/signout", (_req: Request, res: Response) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get("/api/auth/session", (req, res) => {
    const s = readSessionFromReq(req);
    if (!s) return res.json({ user: null });
    res.json({
      user: { id: s.uid, email: s.email, name: s.name, image: s.image },
    });
  });

  // ── Me / user settings ───────────────────────────────────────────
  app.get("/api/me", me);
  app.patch("/api/me", updateMe);

  // ── BYOK keys ────────────────────────────────────────────────────
  app.get("/api/keys", getKeyStatus);
  app.post("/api/keys", setKey);
  app.delete("/api/keys", deleteKey);
  app.post("/api/keys/test", testKey);

  // ── Usage ────────────────────────────────────────────────────────
  app.get("/api/usage", getUsage);

  // ── Feedback ─────────────────────────────────────────────────────
  app.post("/api/feedback", postFeedback);

  // ── OpenRouter streaming proxy ───────────────────────────────────
  app.post("/api/chat/stream", streamChat);

  // ── Sharing ───────────────────────────────────────────────────────
  app.post("/api/share", createShare);
  app.get("/api/share/:token", getShare);

  return httpServer;
}
