/**
 * Google OAuth — minimal, no SDK. Authorization Code flow with PKCE not needed
 * because we have a backend; we use client_secret in the token exchange.
 */
import type { Request, Response } from "express";
import {
  makeOAuthState,
  parseOAuthState,
  getBaseUrl,
  upsertUserFromOAuth,
  signSession,
  setSessionCookie,
  GOOGLE_ENABLED,
} from "./auth";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function redirectUri(req: Request) {
  return `${getBaseUrl(req)}/api/auth/callback/google`;
}

export function googleSignIn(req: Request, res: Response) {
  if (!GOOGLE_ENABLED) {
    res.status(400).send("Google sign-in is not configured.");
    return;
  }
  const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/app";
  const state = makeOAuthState(returnTo);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  res.redirect(`${AUTH_URL}?${params.toString()}`);
}

export async function googleCallback(req: Request, res: Response) {
  const { code, state } = req.query as Record<string, string>;
  if (!code || !state) {
    res.status(400).send("Missing code or state.");
    return;
  }
  const parsed = parseOAuthState(state);
  if (!parsed) {
    res.status(400).send("Invalid state.");
    return;
  }
  try {
    const tokenResp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(req),
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      console.error("google token exchange failed", t);
      res.status(502).send("Google token exchange failed.");
      return;
    }
    const tokenData = (await tokenResp.json()) as { access_token: string };

    const infoResp = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!infoResp.ok) {
      res.status(502).send("Failed to fetch Google profile.");
      return;
    }
    const info = (await infoResp.json()) as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
      email_verified?: boolean;
    };
    if (!info.email) {
      res.status(400).send("Google account has no email.");
      return;
    }

    const user = await upsertUserFromOAuth({
      email: info.email,
      name: info.name,
      image: info.picture,
      provider: "google",
      providerAccountId: info.sub,
    });

    const token = signSession({
      uid: user.id,
      email: user.email,
      name: user.name ?? undefined,
      image: user.image ?? undefined,
    });
    setSessionCookie(res, token);

    const safeReturn = parsed.returnTo.startsWith("/") ? parsed.returnTo : "/app";
    // Use hash-style redirect since the app uses hash routing
    const target = safeReturn === "/" ? "/" : `/#${safeReturn}`;
    res.redirect(target);
  } catch (err) {
    console.error("google callback error", err);
    res.status(500).send("Sign-in failed.");
  }
}
