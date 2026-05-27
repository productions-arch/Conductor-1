import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, GitBranch, Layers, MessageSquare, Sparkles, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ModelBadge } from "@/components/ModelBadge";
import { modelById, MODELS, providerClass } from "@/lib/models";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <ModeShowcase />
      <LiveDemo />
      <Providers />
      <Differentiator />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="border-b border-border sticky top-0 bg-background/80 backdrop-blur z-40">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
        <Link href="/" className="inline-flex items-center gap-2 hover-elevate rounded-md px-1.5 py-1 -ml-1.5" data-testid="link-landing-logo">
          <Logo size={20} />
          <span className="font-semibold tracking-tight">Conductor</span>
        </Link>
        <div className="hidden md:flex items-center gap-5 text-sm text-muted-foreground">
          <a className="hover:text-foreground" href="#modes" onClick={(e) => { e.preventDefault(); document.getElementById("modes")?.scrollIntoView({ behavior: "smooth" }); }}>Modes</a>
          <a className="hover:text-foreground" href="#models" onClick={(e) => { e.preventDefault(); document.getElementById("models")?.scrollIntoView({ behavior: "smooth" }); }}>Models</a>
          <Link href="/pricing" className="hover:text-foreground" data-testid="link-pricing">Pricing</Link>
        </div>
        <div className="flex-1" />
        <a
          href="/api/auth/signin/google?returnTo=/app"
          className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover-elevate"
          data-testid="link-nav-signin"
        >
          Sign in
        </a>
        <Link href="/app" data-testid="link-app">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover-elevate-2">
            Try free
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-28">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-amber-500 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Beta
          </span>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.02] mb-5">
            Every model.
            <br />
            <span className="text-muted-foreground">One workspace.</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
            Chat, compare, and chain AI models — without switching tabs.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/app" data-testid="link-hero-cta">
              <span className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-primary text-primary-foreground font-medium hover-elevate-2">
                Try the demo
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-2">
            {["claude-opus-4", "claude-sonnet-4", "gpt-5", "gpt-4o", "gemini-2.5-pro", "llama-4", "deepseek-v3", "grok-3"].map((id) => (
              <ModelBadge key={id} model={modelById(id)} size="xs" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ModeShowcase() {
  const modes = [
    {
      id: "chat",
      icon: <MessageSquare className="w-4 h-4" />,
      title: "Chat",
      copy: "Switch models per message. One thread, every voice.",
      tagline: "01",
    },
    {
      id: "compare",
      icon: <Layers className="w-4 h-4" />,
      title: "Compare",
      copy: "Same prompt, multiple models, side by side.",
      tagline: "02",
    },
    {
      id: "orchestrate",
      icon: <GitBranch className="w-4 h-4" />,
      title: "Orchestrate",
      copy: "Chain models into pipelines. Draft, critique, refine.",
      tagline: "03",
    },
  ];

  return (
    <section id="modes" className="border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-16 max-w-xl">
          Three ways to work with AI.
        </h2>

        <div className="grid md:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
          {modes.map((m) => (
            <div key={m.id} className="bg-background p-8 flex flex-col gap-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {m.tagline}
              </div>
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary border border-primary/20">
                {m.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">{m.title}</h3>
                <p className="text-sm text-muted-foreground">{m.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LiveDemo() {
  const [step, setStep] = useState(0);
  const exchanges = [
    { user: "Draft a one-line tagline for a multi-agent AI workspace.", model: "claude-opus-4", reply: "Multi-agent AI workflows. One canvas." },
    { user: "Critique it.", model: "gpt-5", reply: "Tight. The rhythm works. Only nit: 'canvas' is doing a lot of work — consider a verb instead." },
    { user: "Refine.", model: "claude-opus-4", reply: "Multi-agent AI workflows. Conducted in one place." },
  ];

  const [typed, setTyped] = useState("");
  useEffect(() => {
    const reply = exchanges[step].reply;
    setTyped("");
    let i = 0;
    const t = setInterval(() => {
      i += 2 + Math.floor(Math.random() * 3);
      if (i >= reply.length) {
        setTyped(reply);
        clearInterval(t);
        setTimeout(() => setStep((s) => (s + 1) % exchanges.length), 3500);
      } else {
        setTyped(reply.slice(0, i));
      }
    }, 28);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const current = exchanges[step];
  const model = modelById(current.model);

  return (
    <section id="demo" className="border-b border-border bg-sidebar/30">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">
              Pass a conversation between models.
            </h2>
            <Link href="/app" data-testid="link-demo-cta">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border hover-elevate font-medium text-sm">
                Open the workspace
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xl">
            <div className="px-4 py-2.5 border-b border-border bg-sidebar/60 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-chart-4/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
              </div>
              <div className="flex-1 text-center text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                conductor · thread
              </div>
            </div>
            <div className="px-5 py-5 space-y-4 min-h-[280px]">
              <div className="flex justify-end animate-fade-in" key={`u-${step}`}>
                <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-muted/60 px-3.5 py-2 text-sm border border-border/50">
                  {current.user}
                </div>
              </div>
              <div className="animate-fade-in" key={`a-${step}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <ModelBadge model={model} size="xs" active />
                </div>
                <div className="text-sm leading-relaxed text-foreground/95">
                  <span className={typed.length < current.reply.length ? "stream-cursor" : ""}>{typed}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Providers() {
  return (
    <section id="models" className="border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-16">
          Every frontier model.
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          {MODELS.map((m) => (
            <div key={m.id} className={`${providerClass(m.provider)} rounded-lg border border-border bg-card p-4 hover-elevate transition-colors`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full provider-dot" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.providerName}
                </span>
              </div>
              <div className="font-medium text-sm">{m.name}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Differentiator() {
  return (
    <section className="border-b border-border bg-sidebar/30">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
          <Comparison title="ChatGPT / Claude" items={["One model per chat", "No cross-model context", "No workflow chains"]} />
          <Comparison title="Poe" items={["Comparison only", "No shared context", "No synthesis step"]} />
          <Comparison title="Conductor" items={["Per-message model picker", "Shared context everywhere", "Multi-step workflows"]} highlight />
        </div>
      </div>
    </section>
  );
}

function Comparison({ title, items, highlight = false }: { title: string; items: string[]; highlight?: boolean }) {
  return (
    <div className={`bg-background p-8 ${highlight ? "bg-primary/5" : ""}`}>
      <div className={`text-[10px] font-mono uppercase tracking-wider mb-5 ${highlight ? "text-primary" : "text-muted-foreground"}`}>
        {title}
      </div>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CTA() {
  return (
    <section className="border-b border-border">
      <div className="max-w-4xl mx-auto px-6 py-28 text-center">
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-8 leading-tight">
          Stop switching tabs.
          <br />
          <span className="text-muted-foreground">Start orchestrating.</span>
        </h2>
        <Link href="/app" data-testid="link-cta-bottom">
          <span className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover-elevate-2">
            Try free
            <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-10 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Logo size={16} />
          <span className="text-xs text-muted-foreground">Conductor · Santa Monica, CA</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/legal/terms" className="hover:text-foreground">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
