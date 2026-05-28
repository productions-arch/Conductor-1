import { useEffect, useRef, useState } from "react";
import { AppShell, type AppMode } from "@/components/AppShell";
import { OnboardingTour } from "@/components/OnboardingTour";
import { useAuth } from "@/lib/auth-store";
import { ChatMode } from "@/components/ChatMode";
import { CompareMode } from "@/components/CompareMode";
import { OrchestrateMode } from "@/components/OrchestrateMode";
import { WorkspaceMode } from "@/components/WorkspaceMode";
import { DocumentsMode } from "@/components/DocumentsMode";
import { WorkspaceRail } from "@/components/WorkspaceRail";
import { ActivityDock, useDockState } from "@/components/ActivityDock";
import { WorkspaceProvider } from "@/lib/workspace-store";
import { RunsProvider } from "@/lib/runs-store";
import { ChatStoreProvider } from "@/lib/chat-store";
import { DocumentsProvider } from "@/lib/documents-store";
import { Info, Zap } from "lucide-react";

export default function AppPage() {
  const [mode, setMode] = useState<AppMode>("chat");

  return (
    <RunsProvider>
      <ChatStoreProvider>
        <WorkspaceProvider>
          <DocumentsProvider>
            <AppShellWithDock mode={mode} setMode={setMode} />
          </DocumentsProvider>
        </WorkspaceProvider>
      </ChatStoreProvider>
    </RunsProvider>
  );
}

function AppShellWithDock({ mode, setMode }: { mode: AppMode; setMode: (m: AppMode) => void }) {
  const dock = useDockState();
  const auth = useAuth();
  const [tourOpen, setTourOpen] = useState(false);
  const seen = useRef(false);

  // Show the tour once per session when a newly-authenticated user lands here.
  // The check is in-memory (localStorage is blocked in the preview sandbox);
  // on a real deploy we could persist via a `has_seen_tour` column on users.
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user) return;
    if (seen.current) return;
    seen.current = true;
    const t = setTimeout(() => setTourOpen(true), 600);
    return () => clearTimeout(t);
  }, [auth.loading, auth.user]);

  return (
    <>
      <AppShell
        mode={mode}
        onModeChange={setMode}
        rightRail={mode === "workspace" ? <WorkspaceRail /> : <Inspector mode={mode} />}
        dockReservedHeight={dock.reservedHeight}
      >
        {mode === "chat" && <ChatMode />}
        {mode === "compare" && <CompareMode />}
        {mode === "orchestrate" && <OrchestrateMode />}
        {mode === "workspace" && <WorkspaceMode />}
        {mode === "documents" && <DocumentsMode />}
      </AppShell>
      <ActivityDock />
      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </>
  );
}

function Inspector({ mode }: { mode: AppMode }) {
  const content = {
    chat: {
      title: "Single chat",
      blurb:
        "Each message you send can be answered by a different model. All models share the full conversation context — so you can have GPT-5 draft, then ask Claude to polish in the next turn without re-explaining.",
      tips: [
        "Pick the model from the dropdown next to send",
        "The badge on each reply shows which model produced it",
        "Switch mid-thread without losing context",
        "Submit while a reply is still streaming to queue the next turn",
      ],
    },
    compare: {
      title: "Compare mode",
      blurb:
        "Send one prompt to 2–4 models in parallel. Watch them stream side-by-side, then synthesize the best parts into a single answer using a model of your choice.",
      tips: [
        "Add up to four columns",
        "Pick any model per column",
        "Synthesize merges the responses",
        "Each column has its own queue — keep typing while they stream",
      ],
    },
    orchestrate: {
      title: "Orchestrate mode",
      blurb:
        "Chain models into a multi-step workflow. Each node sees the output of the previous node. Start from a template or build your own.",
      tips: [
        "Pick a template to start",
        "Add or remove steps",
        "Each step can use a different model",
        "Cancel the in-flight node and retry with a different model",
      ],
    },
    workspace: {
      title: "Workspace",
      blurb:
        "A tiled grid of persistent chat panes — each with its own model. Group panes into channels to broadcast a prompt to several models at once and let them see each other's answers.",
      tips: [
        "Split any pane horizontally or vertically",
        "Assign panes to channels to share context",
        "Broadcast from the right rail to every pane on a channel",
        "Submit while a pane is streaming — it queues; or branch any reply into a new pane",
      ],
    },
  }[mode];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Inspector
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 nice-scroll">
        <h3 className="text-sm font-semibold mb-2">{content.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{content.blurb}</p>

        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Quick tips
        </div>
        <ul className="space-y-2 mb-6">
          {content.tips.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-foreground/85">
              <Zap className="w-3 h-3 text-primary mt-0.5 shrink-0" />
              {t}
            </li>
          ))}
        </ul>

        <div className="rounded-md border border-border bg-muted/30 p-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
            Context
          </div>
          <div className="text-xs leading-relaxed text-foreground/85">
            Logged out, you're in <span className="font-mono text-primary">demo mode</span> with mocked responses. Sign in and add an OpenRouter key to use real models.
          </div>
        </div>
      </div>
    </div>
  );
}
