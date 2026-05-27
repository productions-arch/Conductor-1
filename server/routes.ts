import type { Express, Request, Response } from "express";
import type { Server } from "node:http";

import { clearSessionCookie, readSessionFromReq, APPLE_ENABLED, GOOGLE_ENABLED } from "./auth";
import { googleSignIn, googleCallback } from "./oauth-google";
import { appleSignIn, appleCallback } from "./oauth-apple";
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

  return httpServer;
}
