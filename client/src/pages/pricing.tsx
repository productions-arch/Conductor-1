import { Link } from "wouter";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    blurb: "For trying it out.",
    features: [
      "GPT-4o, Claude Sonnet 4, Gemini 2.5 Flash",
      "Single Chat mode",
      "Compare up to 2 models",
      "5 workflow runs per month",
      "Community support",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$20",
    period: "per month",
    blurb: "For knowledge workers who run on multiple models.",
    features: [
      "All frontier models — GPT-5, Claude Opus 4, Gemini 2.5 Pro, Grok 3, more",
      "All three modes — Chat, Compare, Orchestrate",
      "Compare up to 4 models in parallel",
      "Unlimited workflow runs",
      "Save & share workflows",
      "Priority routing",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    name: "Team",
    price: "$50",
    period: "per seat / month",
    blurb: "For teams that need shared context.",
    features: [
      "Everything in Pro",
      "Shared workspaces with role-based access",
      "Centralized billing & usage analytics",
      "Custom workflow templates per team",
      "SSO (Okta, Azure AD, Google)",
      "Dedicated success contact",
    ],
    cta: "Contact sales",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border sticky top-0 bg-background/80 backdrop-blur z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
          <Link href="/" className="inline-flex items-center gap-2 hover-elevate rounded-md px-1.5 py-1 -ml-1.5" data-testid="link-pricing-home">
            <Logo size={20} />
            <span className="font-semibold tracking-tight">Conductor</span>
          </Link>
          <div className="flex-1" />
          <Link href="/app" data-testid="link-pricing-app">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover-elevate-2">
              Open app
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
      </nav>

      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-6">
            <Sparkles className="w-3 h-3 text-primary" />
            Pricing · billed monthly
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            Pay for the orchestration. Not the model.
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Conductor passes provider costs through transparently. The subscription pays for the
            multi-agent layer — context routing, workflow execution, shared workspaces.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-3 gap-4">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className={`rounded-xl border p-6 flex flex-col ${
                  t.highlight ? "border-primary/40 bg-primary/5 shadow-lg" : "border-border bg-card"
                }`}
                data-testid={`card-tier-${t.name.toLowerCase()}`}
              >
                {t.highlight && (
                  <div className="self-start inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-primary border border-primary/30 bg-primary/10 px-2 py-0.5 rounded-full mb-4">
                    <Sparkles className="w-3 h-3" /> Most popular
                  </div>
                )}
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  {t.name}
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-semibold tracking-tight">{t.price}</span>
                  <span className="text-xs text-muted-foreground">{t.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">{t.blurb}</p>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {t.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${t.highlight ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-foreground/90">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/app" data-testid={`button-cta-${t.name.toLowerCase()}`}>
                  <span
                    className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium ${
                      t.highlight
                        ? "bg-primary text-primary-foreground hover-elevate-2"
                        : "border border-border hover-elevate"
                    }`}
                  >
                    {t.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-lg border border-border bg-sidebar/40 px-6 py-5 max-w-3xl mx-auto">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Provider costs
            </div>
            <p className="text-sm text-foreground/85 leading-relaxed">
              Model usage is billed at provider pass-through rates with a small (3%) gateway fee.
              The Pro tier includes <span className="font-mono text-primary">$10</span> of model
              credits each month — most knowledge workers stay within that envelope.
            </p>
          </div>
        </div>
      </section>

      <footer className="py-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={16} />
            <span className="text-xs text-muted-foreground">Conductor</span>
          </div>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground" data-testid="link-back-home">
            ← Back to home
          </Link>
        </div>
      </footer>
    </div>
  );
}
