import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, GitBranch, Layers, MessageSquare, Sparkles, Github, Play, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ModelBadge } from "@/components/ModelBadge";
import { modelById, MODELS, providerClass } from "@/lib/models";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <ModeShowcase />
      <WhatYouCanDo />
      <LiveDemo />
      <Providers />
      <Differentiator />
      <CTA />
      <Footer />
    </div>
  );
}

function WhatYouCanDo() {
  const items = [
    {
      tag: "Script analysis",
      title: "Read coverage from three perspectives",
      body: "Workspace pane 1: Claude Opus for structural notes. Pane 2: GPT-5 for dialogue critique. Pane 3: Gemini for marketability. Broadcast the script once — read all three reads in parallel.",
      lines: [
        "opus  \u2022 act-2 sags around scene 47; protagonist's goal flips off-screen",
        "gpt   \u2022 dialogue is propulsive in act 1, gets writerly in act 3",
        "gem   \u2022 high-concept but tonally close to 'Severance' \u2014 differentiate the world",
      ],
    },
    {
      tag: "Deal memo critique",
      title: "Pressure-test a memo before sending",
      body: "Orchestrate: model A writes the strongest counter-argument, model B critiques the counter, model C synthesizes the cleanest position. Three models, one final memo \u2014 not a committee.",
      lines: [
        "step 1  opus \u2014 strongest counter-argument",
        "step 2  gpt  \u2014 critique the counter",
        "step 3  sonnet \u2014 synthesize a defensible position",
      ],
    },
    {
      tag: "Research synthesis",
      title: "Triangulate across model knowledge cutoffs",
      body: "Compare mode: send the same research question to four models with different training cutoffs. Watch where they agree, where they diverge, and synthesize the consensus into one citation-ready answer.",
      lines: [
        "gpt-5      \u2705 consensus",
        "opus-4     \u2705 consensus",
        "gemini-2.5 \u26a0 disagrees on dating",
        "deepseek-v3 \u2705 consensus",
      ],
    },
  ];
  return (
    <section className="border-b border-border bg-card/30">
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            What you can do
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Three workflows our beta users actually run.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {items.map((it) => (
            <div key={it.tag} className="rounded-lg border border-border bg-background overflow-hidden flex flex-col">
              <div className="px-5 pt-5 pb-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-primary mb-2">
                  {it.tag}
                </div>
                <h3 className="text-base font-semibold tracking-tight mb-2">{it.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{it.body}</p>
              </div>
              <div className="mt-auto border-t border-border bg-card/60 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground space-y-0.5">
                {it.lines.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
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
            Try the demo
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

      <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-24">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-amber-500">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Beta — invite-only via key
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              8 frontier models · BYOK
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.02] mb-6">
            Every model.
            <br />
            <span className="text-muted-foreground">One workspace.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed mb-8">
            Conductor routes a single conversation across GPT, Claude, Gemini, Llama, DeepSeek, and Grok. Chat with one. Compare four side-by-side. Chain them into multi-step workflows. Bring your own OpenRouter key — one key unlocks every model.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/app" data-testid="link-hero-cta">
              <span className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-primary text-primary-foreground font-medium hover-elevate-2">
                Try the demo
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
            <a
              href="#demo"
              onClick={(e) => { e.preventDefault(); document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" }); }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-md border border-border hover-elevate font-medium"
              data-testid="link-hero-demo"
            >
              <Play className="w-4 h-4" />
              Watch demo
            </a>
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
      title: "Single chat, any model",
      copy: "Switch models per message inside one thread. They all see the full conversation. Use GPT-5 to draft, Claude to refine, Gemini to fact-check — no re-explaining.",
      tagline: "01 / Chat",
    },
    {
      id: "compare",
      icon: <Layers className="w-4 h-4" />,
      title: "Compare in parallel",
      copy: "Run a prompt across two to four models simultaneously. Watch the responses stream side-by-side. Pick the strongest, or synthesize the best parts into a final answer.",
      tagline: "02 / Compare",
    },
    {
      id: "orchestrate",
      icon: <GitBranch className="w-4 h-4" />,
      title: "Orchestrate workflows",
      copy: "Chain models into pipelines. One drafts, another critiques, a third refines. Templates for debate, research, and translation chains — or build your own.",
      tagline: "03 / Orchestrate",
    },
  ];

  return (
    <section id="modes" className="border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Three modes
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Built around how knowledge work actually happens.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
          {modes.map((m) => (
            <div key={m.id} className="bg-background p-6 md:p-8 flex flex-col">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-6">
                {m.tagline}
              </div>
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary border border-primary/20 mb-4">
                {m.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{m.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{m.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LiveDemo() {
  // Mini live chat — cycles through one mocked exchange so the page feels alive.
  const [step, setStep] = useState(0);
  const exchanges = [
    {
      user: "Draft a one-line tagline for a multi-agent AI workspace.",
      model: "claude-opus-4",
      reply: "Multi-agent AI workflows. One canvas.",
    },
    {
      user: "Critique it.",
      model: "gpt-5",
      reply: "Tight. The rhythm works. The pivot from 'workflows' to 'canvas' rewards the reader for paying attention. Only nit: 'canvas' is doing a lot of work — if the product is more conductor than canvas, consider a verb instead.",
    },
    {
      user: "Now refine.",
      model: "claude-opus-4",
      reply: "Multi-agent AI workflows. Conducted in one place.",
    },
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
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Live preview
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
              Watch the conversation pass between models.
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Each model brings a distinct voice — Claude is literary and careful, GPT-5 is structured
              and hedged, Gemini cites sources. Conductor preserves the conversation across all of
              them so you can move between voices without losing the thread.
            </p>
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
                conductor.app / thread
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
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
            Eight models · six providers
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight max-w-2xl mx-auto">
            Every frontier model. One interface.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          {MODELS.map((m) => (
            <div key={m.id} className={`${providerClass(m.provider)} rounded-lg border border-border bg-card p-4 hover-elevate transition-colors`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full provider-dot" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.providerName}
                </span>
              </div>
              <div className="font-medium text-sm mb-1">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.description}</div>
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
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
          <Comparison title="vs. ChatGPT / Claude" items={["One model per chat", "No cross-model context", "No workflow chains"]} />
          <Comparison title="vs. Poe" items={["Side-by-side comparison only", "No shared context", "No synthesis step"]} />
          <Comparison
            title="Conductor"
            items={["Per-message model picker", "Shared context everywhere", "Multi-step workflows on a canvas"]}
            highlight
          />
        </div>
      </div>
    </section>
  );
}

function Comparison({ title, items, highlight = false }: { title: string; items: string[]; highlight?: boolean }) {
  return (
    <div className={`bg-background p-6 md:p-8 ${highlight ? "bg-primary/5" : ""}`}>
      <div className={`text-[10px] font-mono uppercase tracking-wider mb-4 ${highlight ? "text-primary" : "text-muted-foreground"}`}>
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
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-6">
          <Sparkles className="w-3 h-3 text-primary" />
          Free during preview
        </div>
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-6 leading-tight">
          Stop switching tabs.
          <br />
          <span className="text-muted-foreground">Start orchestrating.</span>
        </h2>
        <Link href="/app" data-testid="link-cta-bottom">
          <span className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-medium hover-elevate-2">
            Open the workspace
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
          <span className="text-xs text-muted-foreground">Built by Kane Productions · Santa Monica, CA</span>
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
