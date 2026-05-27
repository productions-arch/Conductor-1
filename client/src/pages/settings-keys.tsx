import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink, Key, Check, Loader2, AlertCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";

export default function SettingsKeysPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | "valid" | "invalid">(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    // If logged out, prompt
    if (!auth.loading && !auth.user) auth.openSignIn("Sign in to manage your API keys.");
  }, [auth.loading, auth.user, auth.openSignIn]);

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/keys/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await r.json();
      setTestResult(data.valid ? "valid" : "invalid");
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast({ title: "Couldn't save key", description: j.error ?? "Try again." });
        return;
      }
      await auth.refresh();
      toast({ title: "Key saved", description: "Real models unlocked." });
      setKey("");
      setEditing(false);
      setTestResult(null);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Remove your OpenRouter key? You'll fall back to demo mode until you add one again.")) return;
    await fetch("/api/keys", { method: "DELETE", credentials: "include" });
    await auth.refresh();
    toast({ title: "Key removed" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SettingsNav />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-xl font-semibold tracking-tight">API keys</h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Conductor is BYOK. Paste your OpenRouter key — one key gives you GPT, Claude, Gemini, Llama, DeepSeek, Grok, and more. We encrypt it at rest with AES-256-GCM and only ever send it server-to-OpenRouter.
        </p>

        <div className="mt-8 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">OpenRouter</span>
          </div>

          {auth.hasKey && !editing ? (
            <div className="flex items-center gap-3">
              <div className="font-mono text-sm">
                sk-or-•••• <span className="text-muted-foreground">{auth.keyLastFour}</span>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setEditing(true)}
                className="text-xs px-2.5 py-1.5 rounded-md border border-border hover-elevate"
                data-testid="button-replace-key"
              >
                Replace
              </button>
              <button
                onClick={remove}
                className="text-xs px-2.5 py-1.5 rounded-md text-rose-500 border border-rose-500/30 hover-elevate"
                data-testid="button-remove-key"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Paste key
              </label>
              <input
                type="password"
                value={key}
                onChange={(e) => { setKey(e.target.value); setTestResult(null); }}
                placeholder="sk-or-..."
                className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="input-openrouter-key"
              />
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={test}
                  disabled={!key || testing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover-elevate disabled:opacity-50"
                  data-testid="button-test-connection"
                >
                  {testing && <Loader2 className="w-3 h-3 animate-spin" />}
                  Test connection
                </button>
                {testResult === "valid" && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-500"><Check className="w-3 h-3" /> Valid</span>
                )}
                {testResult === "invalid" && (
                  <span className="inline-flex items-center gap-1 text-xs text-rose-500"><AlertCircle className="w-3 h-3" /> Invalid key</span>
                )}
                <div className="flex-1" />
                {editing && (
                  <button
                    onClick={() => { setEditing(false); setKey(""); setTestResult(null); }}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={save}
                  disabled={!key || saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover-elevate-2 disabled:opacity-50"
                  data-testid="button-save-openrouter-key"
                >
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save key
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">How to</div>
          </div>
          <ol className="mt-2 space-y-1.5 text-xs text-foreground/85 leading-relaxed list-decimal pl-4">
            <li>
              Open{" "}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-0.5 underline hover:text-foreground">
                openrouter.ai/keys <ExternalLink className="w-3 h-3" />
              </a>{" "}and create a new key.
            </li>
            <li>Add a small amount of credit (a few dollars goes a long way for testing).</li>
            <li>Paste the key above and click Test.</li>
            <li>One OpenRouter key unlocks every model in Conductor.</li>
          </ol>
        </div>

        <div className="mt-6 text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-medium">What we do with your key:</span> encrypt it with AES-256-GCM in our Neon Postgres,
          decrypt only at request time, send it as the Bearer token to OpenRouter, and never log it.
          See the <Link href="/legal/privacy" className="underline hover:text-foreground">privacy policy</Link> for the full story.
        </div>
      </div>
    </div>
  );
}

function SettingsNav() {
  return (
    <nav className="border-b border-border sticky top-0 bg-background/80 backdrop-blur z-40">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
        <Link href="/app" className="inline-flex items-center gap-2 hover-elevate rounded-md px-1.5 py-1 -ml-1.5">
          <Logo size={18} />
          <span className="font-semibold tracking-tight text-sm">Conductor</span>
        </Link>
        <div className="text-muted-foreground/40">/</div>
        <span className="text-sm">Settings</span>
        <div className="flex-1" />
        <Link href="/app" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" />
          Back to app
        </Link>
      </div>
      <div className="max-w-5xl mx-auto px-6 flex items-center gap-1 -mb-px">
        <SettingsTab href="/settings/keys" label="API keys" />
        <SettingsTab href="/settings/usage" label="Usage" />
      </div>
    </nav>
  );
}

function SettingsTab({ href, label }: { href: string; label: string }) {
  const active = typeof window !== "undefined" && window.location.hash.includes(href);
  return (
    <Link
      href={href}
      className={`px-3 py-2 text-xs border-b-2 ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </Link>
  );
}

export { SettingsNav };
