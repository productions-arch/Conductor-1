import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, GitBranch, Layers, MessageSquare, LayoutGrid, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ModelBadge } from "@/components/ModelBadge";
import { modelById, MODELS, providerClass } from "@/lib/models";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Nav />
      <Hero />
      <Stats />
      <Modes />
      <LiveDemo />
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
        <Link href="/" className="inline-flex items-center gap-2 hover-elevate rounded-md px-1.5 py-1 -ml-1.5">
          <Logo size={20} />
          <span className="font-semibold tracking-tight">Conductor</span>
        </Link>
        <div className="hidden md:flex items-center gap-5 text-sm text-muted-foreground">
          <a className="hover:text-foreground transition-colors" href="#modes" onClick={(e) => { e.preventDefault(); document.getElementById("modes")?.scrollIntoView({ behavior: "smooth" }); }}>Modes</a>
          <a className="hover:text-foreground transition-colors" href="#models" onClick={(e) => { e.preventDefault(); document.getElementById("models")?.scrollIntoView({ behavior: "smooth" }); }}>Models</a>
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
        </div>
        <div className="flex-1" />
        <a href="/api/auth/signin/google?returnTo=/app" className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover-elevate transition-colors">
          Sign in
        </a>
        <Link href="/app">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover-elevate-2">
            Try free <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border min-h-[90vh] flex items-center">
      {/* Ambient glow orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-blue-500/8 blur-[100px] pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[300px] h-[300px] rounded-full bg-violet-500/6 blur-[80px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 py-24 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-primary mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Free during beta
            </span>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05] mb-6">
              Every model.{" "}
              <span className="bg-gradient-to-r from-primary via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                One workspace.
              </span>
            </h1>

            <p className="text-lg text-muted-foreground mb-10 leading-relaxed max-w-md">
              Chat, compare, and chain AI models — without switching tabs.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-12">
              <Link href="/app">
                <span className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover-elevate-2 shadow-lg shadow-primary/20">
                  Try the demo <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
              <a href="#modes" onClick={(e) => { e.preventDefault(); document.getElementById("modes")?.scrollIntoView({ behavior: "smooth" }); }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-border hover-elevate font-medium text-sm text-muted-foreground hover:text-foreground transition-colors">
                See how it works
              </a>
            </div>

            <div className="flex flex-wrap gap-2">
              {["claude-opus-4", "claude-sonnet-4", "gpt-5", "gpt-4o", "gemini-2.5-pro", "llama-4", "deepseek-v3", "grok-3"].map((id) => (
                <ModelBadge key={id} model={modelById(id)} size="xs" />
              ))}
            </div>
          </div>

          {/* Right — product mockup */}
          <div className="hidden lg:block">
            <ProductMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductMockup() {
  const [step, setStep] = useState(0);
  const lines = [
    { model: "claude-opus-4", text: "Multi-agent AI workflows. One canvas." },
    { model: "gpt-5", text: "Tight. The rhythm works — but 'canvas' is doing a lot of work." },
    { model: "claude-opus-4", text: "Multi-agent AI workflows. Conducted in one place." },
  ];
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const reply = lines[step].text;
    setTyped("");
    let i = 0;
    const t = setInterval(() => {
      i += 2 + Math.floor(Math.random() * 3);
      if (i >= reply.length) { setTyped(reply); clearInterval(t); setTimeout(() => setStep((s) => (s + 1) % lines.length), 3000); }
      else setTyped(reply.slice(0, i));
    }, 22);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className="relative">
      {/* Glow behind the card */}
      <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-3xl scale-110" />
      <div className="relative rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden shadow-2xl">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-sidebar/80">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/70" />
            <div className="w-3 h-3 rounded-full bg-amber-400/70" />
            <div className="w-3 h-3 rounded-full bg-emerald-400/70" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-background/60 border border-border rounded-md px-3 py-1 text-[10px] font-mono text-muted-foreground text-center">
              conductor.app
            </div>
          </div>
        </div>

        {/* App chrome */}
        <div className="flex h-[360px]">
          {/* Mini sidebar */}
          <div className="w-40 border-r border-border bg-sidebar/60 p-3 flex flex-col gap-1">
            <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60 px-2 mb-1">Recent</div>
            {["Tagline review", "Script notes", "Deal memo"].map((t, i) => (
              <div key={i} className={`text-[11px] px-2 py-1.5 rounded-md truncate ${i === 0 ? "bg-sidebar-accent text-foreground" : "text-muted-foreground"}`}>{t}</div>
            ))}
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 px-4 py-4 space-y-3 overflow-hidden">
              <div className="flex justify-end">
                <div className="max-w-[75%] bg-muted/60 border border-border/50 rounded-2xl rounded-tr-sm px-3 py-2 text-xs">
                  Draft a tagline for a multi-agent AI workspace.
                </div>
              </div>
              {lines.slice(0, step + 1).map((l, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <ModelBadge model={modelById(l.model)} size="xs" active={i === step} />
                  <div className="text-xs leading-relaxed text-foreground/90 pl-1">
                    {i === step
                      ? <span className={typed.length < l.text.length ? "stream-cursor" : ""}>{typed}</span>
                      : l.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <div className="border-t border-border px-3 py-2">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground/50">
                Ask anything…
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stats() {
  const items = [
    { value: "8", label: "frontier models" },
    { value: "4", label: "modes" },
    { value: "1", label: "key unlocks all" },
    { value: "$0", label: "platform fee" },
  ];
  return (
    <div className="border-b border-border bg-sidebar/30">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {items.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-semibold tracking-tight text-primary mb-1">{s.value}</div>
              <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Modes() {
  const modes = [
    {
      id: "chat",
      icon: <MessageSquare className="w-5 h-5" />,
      color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400",
      title: "Chat",
      copy: "Switch models mid-conversation. One thread, every voice.",
      n: "01",
    },
    {
      id: "compare",
      icon: <Layers className="w-5 h-5" />,
      color: "from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400",
      title: "Compare",
      copy: "Same prompt, multiple models, side by side.",
      n: "02",
    },
    {
      id: "orchestrate",
      icon: <GitBranch className="w-5 h-5" />,
      color: "from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-400",
      title: "Orchestrate",
      copy: "Chain models into pipelines. Draft, critique, refine.",
      n: "03",
    },
    {
      id: "workspace",
      icon: <LayoutGrid className="w-5 h-5" />,
      color: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400",
      title: "Workspace",
      copy: "Multi-pane canvas. Run parallel conversations at once.",
      n: "04",
    },
  ];

  return (
    <section id="modes" className="border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="mb-16 text-center">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
            Four ways to work with AI.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modes.map((m) => (
            <div key={m.id} className="group relative rounded-2xl border border-border bg-card p-6 hover-elevate transition-all duration-200 overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${m.color.split(" ").slice(0, 2).join(" ")} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-4">{m.n}</div>
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${m.color} border mb-4`}>
                  {m.icon}
                </div>
                <h3 className="text-base font-semibold mb-2">{m.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{m.copy}</p>
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
    { user: "Critique it.", model: "gpt-5", reply: "Tight. Only nit: 'canvas' is doing a lot of work — consider a verb." },
    { user: "Refine.", model: "claude-opus-4", reply: "Multi-agent AI workflows. Conducted in one place." },
  ];
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const reply = exchanges[step].reply;
    setTyped("");
    let i = 0;
    const t = setInterval(() => {
      i += 2 + Math.floor(Math.random() * 3);
      if (i >= reply.length) { setTyped(reply); clearInterval(t); setTimeout(() => setStep((s) => (s + 1) % exchanges.length), 3500); }
      else setTyped(reply.slice(0, i));
    }, 28);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const current = exchanges[step];
  const model = modelById(current.model);

  return (
    <section id="demo" className="border-b border-border bg-sidebar/20">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 leading-tight">
              Pass a conversation<br />
              <span className="text-muted-foreground">between models.</span>
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Each model brings a different voice. Conductor keeps the thread.
            </p>
            <Link href="/app">
              <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover-elevate font-medium text-sm transition-colors">
                Open the workspace <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-3xl" />
            <div className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-border bg-sidebar/60 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
                </div>
                <div className="flex-1 text-center text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  conductor · thread
                </div>
              </div>
              <div className="px-5 py-6 space-y-4 min-h-[260px]">
                <div className="flex justify-end animate-fade-in" key={`u-${step}`}>
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-muted/60 px-4 py-2.5 text-sm border border-border/50">
                    {current.user}
                  </div>
                </div>
                <div className="animate-fade-in" key={`a-${step}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <ModelBadge model={model} size="xs" active />
                  </div>
                  <p className="text-sm leading-relaxed">
                    <span className={typed.length < current.reply.length ? "stream-cursor" : ""}>{typed}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Differentiator() {
  return (
    <section id="models" className="border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-16 text-center">
          Every frontier model.
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mb-20">
          {MODELS.map((m) => (
            <div key={m.id} className={`${providerClass(m.provider)} group rounded-xl border border-border bg-card p-4 hover-elevate transition-all duration-200`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full provider-dot" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{m.providerName}</span>
              </div>
              <div className="font-medium text-sm">{m.name}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
          {[
            { title: "ChatGPT / Claude.ai", items: ["One model per chat", "No cross-model context", "No workflow chains"], highlight: false },
            { title: "Poe", items: ["Side-by-side only", "No shared context", "No synthesis step"], highlight: false },
            { title: "Conductor", items: ["Per-message model picker", "Shared context everywhere", "Multi-step workflows"], highlight: true },
          ].map(({ title, items, highlight }) => (
            <div key={title} className={`p-8 ${highlight ? "bg-primary/5" : "bg-background"}`}>
              <div className={`text-[10px] font-mono uppercase tracking-wider mb-5 ${highlight ? "text-primary" : "text-muted-foreground"}`}>{title}</div>
              <ul className="space-y-3">
                {items.map((it, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative border-b border-border overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-blue-500/5 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/8 blur-[100px] pointer-events-none" />
      <div className="relative max-w-4xl mx-auto px-6 py-32 text-center">
        <h2 className="text-5xl md:text-6xl font-semibold tracking-tight mb-6 leading-tight">
          Stop switching tabs.
          <br />
          <span className="bg-gradient-to-r from-primary via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
            Start orchestrating.
          </span>
        </h2>
        <p className="text-muted-foreground mb-10 text-lg">Free during beta. Bring your own API key.</p>
        <Link href="/app">
          <span className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-medium text-lg hover-elevate-2 shadow-2xl shadow-primary/30">
            Try free <ArrowRight className="w-5 h-5" />
          </span>
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Logo size={16} />
          <span className="text-xs text-muted-foreground">Conductor · Santa Monica, CA</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/legal/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
