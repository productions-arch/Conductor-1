# Conductor — Beta Launch Guide

This walks you from zero to a live Vercel beta in ~30 minutes. Everything is
BYOK (users paste their own OpenRouter keys) and free-tier hostable.

---

## 0. Prerequisites

- A GitHub account (for the Vercel connection)
- A Google Cloud account (free)
- A Neon account (free): https://neon.tech
- A Vercel account (free hobby tier): https://vercel.com
- `openssl` on your machine (any macOS/Linux/WSL terminal has this)

Optional:
- An Apple Developer account ($99/yr) if you want Sign-in with Apple

---

## 1. Create the Neon database

1. Go to https://console.neon.tech → **New Project**
2. Name it `conductor`, choose a region close to your Vercel region
   (e.g. `us-east-2`)
3. After creation, open **Connection details** → choose the **Pooled connection**
4. Copy the connection string. It looks like:
   ```
   postgresql://user:pw@ep-xyz-pooler.us-east-2.aws.neon.tech/conductor?sslmode=require
   ```
5. Save this as `DATABASE_URL`.

---

## 2. Generate crypto secrets

In a terminal:

```bash
openssl rand -base64 32   # → ENCRYPTION_KEY
openssl rand -base64 32   # → AUTH_SECRET
```

Save both — these are different values. **Do not commit them.**

---

## 3. Create Google OAuth client

1. https://console.cloud.google.com → create a new project (or pick one)
2. **APIs & Services → OAuth consent screen** → External → fill in:
   - App name: `Conductor`
   - Support email: yours
   - Authorised domains: `vercel.app` (or your custom domain)
3. Add scopes: `email`, `profile`, `openid`. Save.
4. **Credentials → Create Credentials → OAuth client ID → Web application**
5. Authorized redirect URIs (add both):
   - `http://localhost:5000/api/auth/callback/google` (local dev)
   - `https://<your-app>.vercel.app/api/auth/callback/google` (replace after step 6)
6. Save **Client ID** → `GOOGLE_CLIENT_ID` and **Client Secret** → `GOOGLE_CLIENT_SECRET`.

You can add the production redirect after the first Vercel deploy gives you a URL.

---

## 4. (Optional) Apple Sign-in

Skip this section for the initial beta — leave `APPLE_CLIENT_ID` blank and the
button stays hidden.

When ready:

1. Apple Developer → **Identifiers → +** → **Services IDs** (NOT App IDs)
   - Identifier: `com.kane.conductor.web` → this is `APPLE_CLIENT_ID`
   - Enable **Sign in with Apple**, configure:
     - Domains: `<your-app>.vercel.app`
     - Return URLs: `https://<your-app>.vercel.app/api/auth/callback/apple`
2. **Keys → +** → Sign in with Apple → download the `.p8` file
   - Note the **Key ID** → `APPLE_KEY_ID`
3. Membership → **Team ID** → `APPLE_TEAM_ID`
4. The `.p8` file contents (including `-----BEGIN…` / `-----END…` lines) →
   `APPLE_PRIVATE_KEY`. In Vercel, paste raw with line breaks preserved.

---

## 5. Push the repo to GitHub

```bash
cd conductor
git init
git add -A
git commit -m "Conductor beta — initial commit"
gh repo create kane-productions/conductor --private --source=. --push
```

Or use the GitHub web UI: create a new repo, then
`git remote add origin … && git push -u origin main`.

**Do NOT commit `.env`.** Only `.env.example` is tracked.

---

## 6. Deploy to Vercel

1. https://vercel.com → **Add New → Project** → import your `conductor` repo
2. Framework preset: **Other**
3. Build command: `npm run build` (already configured in `vercel.json`)
4. Output directory: `dist/public` (already configured)
5. **Environment Variables** — paste all of these:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon pooled URL | From step 1 |
| `ENCRYPTION_KEY` | base64 32 bytes | From step 2 |
| `AUTH_SECRET` | base64 32 bytes | From step 2 |
| `GOOGLE_CLIENT_ID` | …apps.googleusercontent.com | From step 3 |
| `GOOGLE_CLIENT_SECRET` | secret | From step 3 |
| `PUBLIC_BASE_URL` | https://<your-app>.vercel.app | Fill in after first deploy |
| `APPLE_CLIENT_ID` | (optional) | Leave blank to hide Apple |
| `APPLE_TEAM_ID` | (optional) | |
| `APPLE_KEY_ID` | (optional) | |
| `APPLE_PRIVATE_KEY` | (optional) | Paste full .p8 contents |

6. Click **Deploy**. First build takes ~2–3 minutes.

After deploy, copy the assigned URL (e.g. `conductor-xyz.vercel.app`) and:
- Update `PUBLIC_BASE_URL` env var to that URL → redeploy
- Add `https://<that-url>/api/auth/callback/google` to your Google OAuth
  credential's authorised redirect URIs

---

## 7. Run database migrations

The schema lives in `shared/schema.ts`. Push it to Neon:

```bash
# Locally with DATABASE_URL exported:
npm run db:push
```

This uses `drizzle-kit push` to apply the current schema directly. No migration
files needed for the beta — `drizzle-kit` diffs and applies.

You can also run this from a Vercel **deploy hook** or via `vercel env pull`
then `npm run db:push` locally with the pulled env.

---

## 8. Smoke test

Visit your deployed URL:

1. Landing page should load
2. "Try the demo" → opens the app in mocked mode (no key needed)
3. Try **Chat / Compare / Orchestrate / Workspace** — all responses are mocked
4. Click **Sign in** → Google OAuth → returns to app
5. Open **Account → API Keys** → paste a real OpenRouter key → **Test** → save
6. Try a real prompt — you should see live model output streaming in

---

## 9. Architectural notes (good to know)

- **Auth.** We use hand-rolled JWT sessions in `server/auth.ts`, not Auth.js v5,
  because the existing app is Vite + Express + wouter (hash routing). Auth.js v5
  is built around Next.js. The implementation is RFC-7519 HS256, cookie name
  `conductor_session`, 30-day TTL, signed with `AUTH_SECRET`.
- **OpenRouter proxy** runs on Node (not Edge). Vercel Node functions stream
  fine. Max duration is set to 300s in `vercel.json`.
- **BYOK encryption.** Keys are encrypted at rest with AES-256-GCM
  (`server/crypto.ts`). Decryption happens in-memory per request and the
  plaintext key is never logged or returned to the client.
- **Spend cap.** Daily USD cap per user is enforced before each request
  in `server/openrouter.ts`. Default is $5/day; users can change it in
  `/settings/usage`.
- **Mocked demo mode.** Logged-out users see canned responses (`client/src/lib/ai-gateway.ts`).
  Sending a real prompt opens the sign-in modal.

---

## 10. Costs

- **Neon free tier:** 0.5 GB storage, autoscale to 0 — fine for hundreds of users
- **Vercel hobby:** 100 GB bandwidth, 100 GB-hrs function execution
- **Google OAuth:** free
- **OpenRouter:** users pay their own — Conductor never funds inference

---

## 11. Troubleshooting

- **"Database is not configured"** — `DATABASE_URL` missing or wrong
- **"Authentication is not configured"** — `AUTH_SECRET` or `ENCRYPTION_KEY` missing
- **Google sign-in 400 redirect_uri_mismatch** — the redirect URI in your
  Google OAuth client doesn't exactly match `<PUBLIC_BASE_URL>/api/auth/callback/google`
- **OpenRouter 401** — user's key is invalid; ask them to re-test in `/settings/keys`
- **Streaming hangs** — Vercel function timeout (default 10s on hobby). The
  `vercel.json` already sets `maxDuration: 300`. Verify it's applied in the
  Vercel dashboard.

---

Built by Kane Productions · Santa Monica, CA
