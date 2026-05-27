/**
 * Apple "Sign in with Apple" — gated behind APPLE_CLIENT_ID env var presence.
 * When absent, the API endpoints respond 503 and the client hides the button.
 *
 * Implementation notes (for when APPLE_CLIENT_ID is configured):
 *   - The "client secret" Apple expects is a JWT signed with the .p8 private key
 *     downloaded from Apple Developer. We expect APPLE_PRIVATE_KEY (PEM,
 *     base64-encoded), APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_CLIENT_ID
 *     (a.k.a. the Services ID).
 *   - The callback receives `code` + `id_token` (a JWT). We trust the id_token
 *     claims for email + sub (Apple does not return a userinfo endpoint).
 *   - Apple only returns the user's name on the first sign-in; we accept that.
 */
import { createSign } from "node:crypto";
import type { Request, Response } from "express";
import {
  makeOAuthState,
  parseOAuthState,
  getBaseUrl,
  upsertUserFromOAuth,
  signSession,
  setSessionCookie,
  APPLE_ENABLED,
} from "./auth";

const AUTH_URL = "https://appleid.apple.com/auth/authorize";
const TOKEN_URL = "https://appleid.apple.com/auth/token";

function redirectUri(req: Request) {
  return `${getBaseUrl(req)}/api/auth/callback/apple`;
}

function appleClientSecret(): string {
  const team = process.env.APPLE_TEAM_ID!;
  const kid = process.env.APPLE_KEY_ID!;
  const sub = process.env.APPLE_CLIENT_ID!;
  const key = Buffer.from(process.env.APPLE_PRIVATE_KEY!, "base64").toString("utf8");
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid, typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: team,
      iat: now,
      exp: now + 60 * 60 * 24 * 180, // 180 days max
      aud: "https://appleid.apple.com",
      sub,
    }),
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  // ES256 signature
  const sig = signer.sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${header}.${payload}.${sig}`;
}

export function appleSignIn(req: Request, res: Response) {
  if (!APPLE_ENABLED) {
    res.status(503).send("Apple sign-in is not configured yet.");
    return;
  }
  const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/app";
  const state = makeOAuthState(returnTo);
  const params = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID!,
    redirect_uri: redirectUri(req),
    response_type: "code id_token",
    response_mode: "form_post",
    scope: "email name",
    state,
  });
  res.redirect(`${AUTH_URL}?${params.toString()}`);
}

function decodeJwtPayload(jwt: string): any {
  const p = jwt.split(".")[1];
  if (!p) return {};
  const pad = p.length % 4 === 0 ? "" : "=".repeat(4 - (p.length % 4));
  return JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8"));
}

export async function appleCallback(req: Request, res: Response) {
  if (!APPLE_ENABLED) {
    res.status(503).send("Apple sign-in is not configured yet.");
    return;
  }
  const code = (req.body?.code as string) || (req.query.code as string);
  const state = (req.body?.state as string) || (req.query.state as string);
  const idTokenFromForm = (req.body?.id_token as string) || (req.query.id_token as string);
  const userJson = req.body?.user as string | undefined;
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
        client_id: process.env.APPLE_CLIENT_ID!,
        client_secret: appleClientSecret(),
        redirect_uri: redirectUri(req),
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      console.error("apple token exchange failed", t);
      res.status(502).send("Apple token exchange failed.");
      return;
    }
    const tokenData = (await tokenResp.json()) as { id_token?: string };
    const idToken = tokenData.id_token || idTokenFromForm;
    const claims = decodeJwtPayload(idToken);

    let name: string | undefined;
    if (userJson) {
      try {
        const u = JSON.parse(userJson);
        name = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(" ") || undefined;
      } catch {/* ignore */}
    }

    if (!claims.email) {
      res.status(400).send("Apple account has no email.");
      return;
    }

    const user = await upsertUserFromOAuth({
      email: claims.email,
      name,
      image: undefined,
      provider: "apple",
      providerAccountId: claims.sub,
    });

    const token = signSession({
      uid: user.id,
      email: user.email,
      name: user.name ?? undefined,
      image: user.image ?? undefined,
    });
    setSessionCookie(res, token);

    const safeReturn = parsed.returnTo.startsWith("/") ? parsed.returnTo : "/app";
    const target = safeReturn === "/" ? "/" : `/#${safeReturn}`;
    res.redirect(target);
  } catch (err) {
    console.error("apple callback error", err);
    res.status(500).send("Sign-in failed.");
  }
}
