import { useEffect, useState } from "react";
import { SettingsNav } from "./settings-keys";
import { useAuth } from "@/lib/auth-store";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ModelBadge } from "@/components/ModelBadge";
import { modelById, providerClass } from "@/lib/models";

interface UsageData {
  today: number;
  month: number;
  byModel: Array<{ modelId: string; cost: number; promptTokens: number; completionTokens: number; count: number }>;
  daily: Array<{ day: string; cost: number }>;
}

export default function SettingsUsagePage() {
  const auth = useAuth();
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cap, setCap] = useState(5);
  const [savingCap, setSavingCap] = useState(false);

  useEffect(() => {
    if (!auth.loading && !auth.user) auth.openSignIn("Sign in to view your usage.");
  }, [auth.loading, auth.user, auth.openSignIn]);

  useEffect(() => {
    if (!auth.user) return;
    setCap(auth.user.dailySpendCapUsd ?? 5);
  }, [auth.user]);

  useEffect(() => {
    if (!auth.user) return;
    (async () => {
      try {
        const r = await fetch("/api/usage", { credentials: "include" });
        if (r.ok) setData(await r.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [auth.user]);

  // Build a complete 30-day daily series (zero-filled)
  const daily = (() => {
    const out: Array<{ day: string; cost: number }> = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const map = new Map((data?.daily ?? []).map((d) => [d.day, d.cost]));
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key.slice(5), cost: Number(map.get(key) ?? 0) });
    }
    return out;
  })();

  async function saveCap() {
    setSavingCap(true);
    try {
      await auth.setDailyCap(cap);
    } finally {
      setSavingCap(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SettingsNav />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-xl font-semibold tracking-tight">Usage</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Token use and cost across every model. We compute cost from OpenRouter's per-model pricing.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
          <KpiCard label="Today" value={`$${(data?.today ?? 0).toFixed(2)}`} />
          <KpiCard label="This month" value={`$${(data?.month ?? 0).toFixed(2)}`} />
          <KpiCard label="Cap (today)" value={`$${cap.toFixed(2)}`} />
        </div>

        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-medium">Daily spend cap</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">USD</div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When today's spend hits this cap, Conductor blocks further real-model calls until tomorrow. Demo mode keeps working.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <input
              type="number"
              min={0}
              max={1000}
              step={0.5}
              value={cap}
              onChange={(e) => setCap(Number(e.target.value))}
              className="w-28 bg-muted/50 border border-border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="input-daily-cap"
            />
            <button
              onClick={saveCap}
              disabled={savingCap || cap === (auth.user?.dailySpendCapUsd ?? 5)}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover-elevate-2 disabled:opacity-50"
              data-testid="button-save-cap"
            >
              Save
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="text-sm font-medium mb-3">Last 30 days</div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 11,
                    borderRadius: 6,
                  }}
                  formatter={(v: number) => [`$${v.toFixed(4)}`, "Spend"]}
                />
                <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="text-sm font-medium mb-3">By model (this month)</div>
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : (data?.byModel.length ?? 0) === 0 ? (
            <div className="text-xs text-muted-foreground">No usage yet. Send a real prompt to populate.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  <th className="text-left py-1.5 font-normal">Model</th>
                  <th className="text-right py-1.5 font-normal">Calls</th>
                  <th className="text-right py-1.5 font-normal">Input tok</th>
                  <th className="text-right py-1.5 font-normal">Output tok</th>
                  <th className="text-right py-1.5 font-normal">Cost</th>
                </tr>
              </thead>
              <tbody>
                {data?.byModel.map((r) => {
                  const m = modelById(r.modelId);
                  return (
                    <tr key={r.modelId} className="border-t border-border">
                      <td className="py-2">
                        <ModelBadge name={m.name} providerClass={providerClass(m.provider)} />
                      </td>
                      <td className="text-right font-mono">{r.count}</td>
                      <td className="text-right font-mono">{r.promptTokens.toLocaleString()}</td>
                      <td className="text-right font-mono">{r.completionTokens.toLocaleString()}</td>
                      <td className="text-right font-mono">${r.cost.toFixed(4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1 font-mono">{value}</div>
    </div>
  );
}
