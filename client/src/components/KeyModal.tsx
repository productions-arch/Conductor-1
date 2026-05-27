/**
 * Inline "Add your OpenRouter key" modal — used after sign-in when the user
 * doesn't yet have a key on file. The full Settings page at /settings/keys is
 * the canonical place; this modal is a fast path so the user can resume what
 * they were doing.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Key, ExternalLink, Loader2, Check } from "lucide-react";

export function KeyModal() {
  const { keyModalOpen, closeKeyModal, refresh } = useAuth();
  const { toast } = useToast();
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | "valid" | "invalid">(null);
  const [saving, setSaving] = useState(false);

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
      await refresh();
      toast({ title: "Key saved", description: "You're ready to send real prompts." });
      closeKeyModal();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={keyModalOpen} onOpenChange={(o) => !o && closeKeyModal()}>
      <DialogContent className="sm:max-w-md">
        <div className="flex items-start gap-3">
          <div className="rounded-md p-2 bg-card border border-border">
            <Key className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold tracking-tight">Add your OpenRouter key</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              Conductor is BYOK. Paste an OpenRouter key — that's one key for every model. We encrypt it at rest and only ever send it server-to-OpenRouter.
            </DialogDescription>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">OpenRouter API key</label>
            <input
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setTestResult(null); }}
              placeholder="sk-or-..."
              className="mt-1 w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="input-key"
            />
          </div>
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Create a key on OpenRouter <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={test}
              disabled={!key || testing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover-elevate disabled:opacity-50"
              data-testid="button-test-key"
            >
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Test connection
            </button>
            {testResult === "valid" && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500"><Check className="w-3 h-3" /> Valid</span>
            )}
            {testResult === "invalid" && (
              <span className="text-[11px] text-rose-500">Invalid key</span>
            )}
            <div className="flex-1" />
            <button
              onClick={save}
              disabled={!key || saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover-elevate-2 disabled:opacity-50"
              data-testid="button-save-key"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
