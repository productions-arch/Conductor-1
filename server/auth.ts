/**
 * Lightweight JWT-based auth for Conductor.
 *
 * We use a hand-rolled OAuth flow (Google + optional Apple) and JWT session
 * cookies. Auth.js / next-auth would bring a Next dependency we don't want —
 * the existing app is Vite + Express. JWT cookies are stateless and work fine
 * on Vercel free tier (including Edge functions, though our streaming proxy
 * runs on Node so it can use AbortController + ReadableStream cleanly).
 *
 * Cookie name: `conductor_session`
 * Lifetime:    30 days
 * Storage:     HttpOnly, Secure (in prod), SameSite=Lax
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "../shared/schema";

const SESSION_COOKIE = "conductor_session";
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function getSecret(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET missing — generate with `openssl rand -base64 32`.");
  return Buffer.from(s, "utf8");
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export interface SessionClaims {
  uid: string;
  email: string;
  name?: string;
  image?: string;
  /** Issued-at, seconds */
  iat: number;
  /** Expires, seconds */
  exp: number;
}

export function signSession(claims: Omit<SessionClaims, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const body: SessionClaims = { ...claims, iat: now, exp: now + SESSION_MAX_AGE_S };
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(body));
  const sig = createHmac("sha256", getSecret()).update(`${header}.${payload}`).digest();
  return `${header}.${payload}.${b64url(sig)}`;
}

export function verifySession(token: string): SessionClaims | null {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const expected = createHmac("sha256", getSecret()).update(`${h}.${p}`).digest();
    const got = b64urlDecode(s);
    if (expected.length !== got.length) return null;
    if (!timingSafeEqual(expected, got)) return null;
    const claims = JSON.parse(b64urlDecode(p).toString("utf8")) as SessionClaims;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  const cookie = [
    `${SESSION_COOKIE}=${token}`,
    `Path=/`,
    `Max-Age=${SESSION_MAX_AGE_S}`,
    `HttpOnly`,
    `SameSite=Lax`,
    isProd ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
  res.setHeader("Set-Cookie", cookie);
}

export function clearSessionCookie(res: Response) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
  );
}

export function readSessionFromReq(req: Request): SessionClaims | null {
  const cookieHeader = req.headers.cookie ?? "";
  const m = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  if (!m) return null;
  return verifySession(decodeURIComponent(m[1]));
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const session = readSessionFromReq(req);
  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  (req as any).session = session;
  next();
}

/** Upsert a user record from OAuth profile. */
export async function upsertUserFromOAuth(profile: {
  email: string;
  name?: string;
  image?: string;
  provider: "google" | "apple";
  providerAccountId: string;
}) {
  if (!db) throw new Error("DATABASE_URL not configured");
  const existing = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
  if (existing.length) {
    const u = existing[0];
    // Update last-known profile info
    await db
      .update(users)
      .set({
        name: profile.name ?? u.name,
        image: profile.image ?? u.image,
        provider: u.provider, // keep original provider on file
        providerAccountId: u.providerAccountId ?? profile.providerAccountId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, u.id));
    return { ...u, name: profile.name ?? u.name, image: profile.image ?? u.image };
  }
  const inserted = await db
    .insert(users)
    .values({
      email: profile.email,
      name: profile.name,
      image: profile.image,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
    })
    .returning();
  return inserted[0];
}

/** Crypto-random state token for OAuth CSRF protection. */
export function makeOAuthState(returnTo: string): string {
  const r = randomBytes(16).toString("hex");
  return b64url(JSON.stringify({ r, returnTo }));
}
export function parseOAuthState(state: string): { r: string; returnTo: string } | null {
  try {
    return JSON.parse(b64urlDecode(state).toString("utf8"));
  } catch {
    return null;
  }
}

export const APPLE_ENABLED = !!process.env.APPLE_CLIENT_ID;
export const GOOGLE_ENABLED = !!process.env.GOOGLE_CLIENT_ID;

export function getBaseUrl(req: Request): string {
  const fromEnv = process.env.PUBLIC_BASE_URL || process.env.AUTH_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}
