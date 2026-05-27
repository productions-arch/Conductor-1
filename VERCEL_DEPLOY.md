# Deploy Conductor to Vercel (demo mode)

This guide gets your friends a public URL in ~15 minutes. No database, no OAuth, no API keys needed. Everything runs in mocked demo mode.

## What you need
- GitHub account (free)
- Vercel account (free, sign up with GitHub)
- Git installed locally OR GitHub Desktop

## Steps

### 1. Get the code onto your machine

1. Download `conductor-vercel-bundle.zip` from this conversation (it's attached as a file).
2. Unzip it. You'll get a folder called `conductor/`.
3. Open a terminal and `cd` into that folder:
   ```bash
   cd ~/Downloads/conductor    # or wherever you unzipped it
   ```
   On macOS you can also drag the folder onto the Terminal icon in the Dock to open a shell there.
4. (Optional but recommended) Run `npm install` and `npm run build:vercel` once locally to confirm the project builds on your machine before pushing. You'll need Node 20+.

### 2. Push to GitHub

```bash
cd conductor
git init
git add .
git commit -m "initial"
gh repo create conductor --private --source=. --push
```

If you don't have the `gh` CLI:

1. Go to <https://github.com/new>, create a new **private** repo called `conductor`, and **do not** initialize it with a README or `.gitignore` (the bundle already has one).
2. Then back in your terminal:
   ```bash
   git remote add origin https://github.com/<your-username>/conductor.git
   git branch -M main
   git push -u origin main
   ```

### 3. Import to Vercel

1. Go to <https://vercel.com/new>.
2. Click **Import** next to your `conductor` repo. (If you don't see it, click **Adjust GitHub App Permissions** and grant Vercel access to the repo.)
3. On the configure screen, set these values **exactly**:
   - **Framework Preset:** `Other`
   - **Root Directory:** leave as the repo root (`./`)
   - **Build Command:** `npm run build:vercel`  *(check the "Override" box to enter it)*
   - **Output Directory:** `dist/public`  *(check the "Override" box to enter it)*
   - **Install Command:** leave as default (`npm install`)
4. Expand **Environment Variables** and add one variable:
   - Key: `BUILD_TARGET`
   - Value: `vercel`
   - Apply to: Production, Preview, Development (default is all three — leave it)
5. Click **Deploy**. The first build takes 1–3 minutes.

### 4. Share the link

Vercel gives you a URL like `https://conductor-abc123.vercel.app`. Open it, click around — Chat, Compare, Orchestrate, and Workspace should all work. The DEMO MODE badge will be visible in the header; that's expected.

Share the URL with your friends. Every visitor sees the same mocked behavior locally in their browser — no shared state, no accounts, nothing to set up.

### 5. When you're ready for real models, auth, persistence

See `BETA_LAUNCH.md` for the full production setup (Postgres, OAuth, BYOK encryption). That path swaps this static deploy for a real Node host (Render, Railway, Fly, or Vercel with serverless functions) once you actually need the backend.

---

## Troubleshooting

**Build fails with `node:>=20.x` error.** In Vercel project settings → General → Node.js Version, pick `20.x` or `22.x`.

**Page loads blank.** Open the browser console. A few `404` errors on `/api/me`, `/api/auth/providers`, and `/api/feedback` are expected and harmless — those endpoints don't exist on the static deploy, and the app falls back to demo mode automatically. If you see a JavaScript error instead, file an issue with the console output.

**Routes 404 on refresh.** The app uses hash routing (`/#/chat`, `/#/compare`, etc.) so this shouldn't happen, but the included `vercel.json` also has an SPA rewrite as a safety net.

**Want to redeploy after a code change.** Push to `main` on GitHub. Vercel auto-deploys every push.
