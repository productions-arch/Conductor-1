import { useEffect, useMemo, useState } from "react";
import { ArrowRight, X, Key } from "lucide-react";
import { useLocation } from "wouter";

const TOUR_STORAGE_KEY = "conductor-tour-v1";

export function useTourSeen() {
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem(TOUR_STORAGE_KEY) === "done"; } catch { return false; }
  });
  const markSeen = () => {
    try { localStorage.setItem(TOUR_STORAGE_KEY, "done"); } catch {}
    setSeen(true);
  };
  return { seen, markSeen };
}

interface Step {
  selector: string;
  title: string;
  body: string;
  ctaLabel?: string;
  action?: "go-to-keys";
}

const STEPS: Step[] = [
  { selector: "[data-tour='model-picker']", title: "Pick any model", body: "Send each turn to a different model. They all share the conversation context." },
  { selector: "[data-testid='tab-compare']", title: "Compare them side by side", body: "Send one prompt to 2–4 models in parallel. Watch them stream, then synthesize." },
  { selector: "[data-testid='tab-orchestrate']", title: "Build workflows", body: "Chain models into multi-step pipelines. Each node sees the previous output." },
  { selector: "[data-testid='tab-workspace']", title: "Build your own workspace", body: "Tile chat panes, group them into channels, and broadcast prompts." },
  { selector: "[data-testid='button-signin-nav'], [data-testid='chip-spend']", title: "Unlock real models", body: "Sign in and add your free OpenRouter key — one key gives you GPT, Claude, Gemini, DeepSeek, and more. A few dollars of credit covers hundreds of queries.", ctaLabel: "Add my key", action: "go-to-keys" },
];

export function OnboardingTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [, setLocation] = useLocation();

  const step = STEPS[stepIdx];

  // Measure target element
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      setRect(el.getBoundingClientRect());
    };
    measure();
    const t = setTimeout(measure, 60); // re-measure after layout settles
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, stepIdx, step.selector]);

  // Key navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") setStepIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIdx]);

  function next() {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      onClose();
      if (step.action === "go-to-keys") setLocation("/settings/keys");
    }
  }

  const tooltipPos = useMemo(() => {
    const w = window.innerWidth;
    if (!rect) return { left: Math.max(16, (w - 340) / 2), top: 80 };
    const top = Math.min(rect.bottom + 12, window.innerHeight - 220);
    const left = Math.max(16, Math.min(rect.left, w - 360 - 16));
    return { left, top };
  }, [rect]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* dim overlay */}
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-[1px] pointer-events-auto"
        onClick={onClose}
        aria-hidden
      />

      {/* spotlight ring */}
      {rect && (
        <div
          className="absolute rounded-md ring-2 ring-primary/80 pointer-events-none transition-all duration-300"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
          }}
        />
      )}

      {/* tooltip */}
      <div
        className="absolute w-[340px] max-w-[calc(100vw-32px)] bg-card border border-border rounded-lg shadow-xl p-4 pointer-events-auto"
        style={{ left: tooltipPos.left, top: tooltipPos.top }}
      >
        <div className="flex items-start gap-3 mb-2">
          <div className="flex-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              {stepIdx + 1} / {STEPS.length}
            </div>
            <div className="flex items-center gap-1.5">
              {step.action === "go-to-keys" && <Key className="w-3.5 h-3.5 text-primary" />}
              <div className="text-sm font-semibold tracking-tight">{step.title}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover-elevate text-muted-foreground -mt-0.5 -mr-1"
            aria-label="Close tour"
            data-testid="button-tour-close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>

        <div className="flex items-center gap-2 mt-4">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === stepIdx ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </div>
          <div className="flex-1" />
          {stepIdx > 0 && (
            <button
              onClick={() => setStepIdx(stepIdx - 1)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover-elevate"
              data-testid="button-tour-back"
            >
              Back
            </button>
          )}
          <button
            onClick={next}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover-elevate-2"
            data-testid="button-tour-next"
          >
            {step.ctaLabel ?? "Next"}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
