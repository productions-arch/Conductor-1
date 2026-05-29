import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  MessageSquare,
  GitBranch,
  Layers,
  LayoutGrid,
  Plus,
  Search,
  Settings,
  Sun,
  Moon,
  Sparkles,
  Folder,
  LogOut,
  MessageCircle,
  Key,
  Menu,
  ChevronsUpDown,
  FileText,
} from "lucide-react";
import { Logo } from "./Logo";
import { EXAMPLE_CONVERSATIONS, SAVED_WORKFLOWS } from "@/lib/mock-data";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/lib/auth-store";
import { useGatewayMode } from "@/hooks/use-gateway-mode";
import { FeedbackModal } from "./FeedbackWidget";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type AppMode = "chat" | "compare" | "orchestrate" | "workspace" | "documents";

interface AppShellProps {
  children: ReactNode;
  /** "chat" | "compare" | "orchestrate" | "workspace" */
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  rightRail?: ReactNode;
  /** Pixels to reserve at the bottom for the ActivityDock (4 hidden, 48 collapsed, 0 expanded) */
  dockReservedHeight?: number;
}

export function AppShell({ children, mode, onModeChange, rightRail, dockReservedHeight = 0 }: AppShellProps) {
  const [sidebarState, setSidebarState] = useState<"open" | "icons" | "closed">("open");
  const [isMobile, setIsMobile] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const sidebarOpen = sidebarState !== "closed";
  const setSidebarOpen = (open: boolean) => setSidebarState(open ? "open" : "closed");

  function cycleSidebar() {
    setSidebarState((s) => s === "open" ? "icons" : s === "icons" ? "closed" : "open");
  }
  const { theme, toggle } = useTheme();
  const [, setLocation] = useLocation();
  const auth = useAuth();
  const mode_ = useGatewayMode();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Listen for the global feedback-open event (fired from BetaBanner / landing).
  useEffect(() => {
    const handler = () => setFeedbackOpen(true);
    window.addEventListener("conductor:open-feedback", handler);
    return () => window.removeEventListener("conductor:open-feedback", handler);
  }, []);

  useEffect(() => {
    const check = () => {
      const m = window.innerWidth < 768;
      setIsMobile(m);
      if (m) setSidebarOpen(false);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div
      className="h-screen w-full flex bg-background text-foreground overflow-hidden"
      style={{ paddingBottom: isMobile ? 56 : dockReservedHeight }}
    >
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* LEFT SIDEBAR */}
      <aside
        className={`${
          sidebarState === "open" ? "w-64" : sidebarState === "icons" ? "w-14" : "w-0"
        } ${isMobile ? "fixed left-0 top-0 bottom-0 z-40" : "shrink-0"} border-r border-border bg-sidebar overflow-hidden transition-[width] duration-200 flex flex-col`}
      >
        {/* Header */}
        <div className="px-3 py-4 border-b border-border flex items-center justify-between shrink-0">
          <Link href="/" data-testid="link-home" className="inline-flex items-center gap-2 hover-elevate rounded-md px-1 py-1">
            <Logo size={20} />
            {sidebarState === "open" && <span className="font-semibold tracking-tight text-sm">Conductor</span>}
          </Link>
          {sidebarState === "open" && (
            <button onClick={toggle} className="p-1.5 rounded-md hover-elevate text-muted-foreground" aria-label="Toggle theme" data-testid="button-theme-toggle">
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* New thread button */}
        <div className="px-2 py-3 shrink-0">
          <button
            onClick={() => onModeChange("chat")}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover-elevate-2`}
            data-testid="button-new-chat"
            title="New thread"
          >
            <Plus className="w-4 h-4 shrink-0" />
            {sidebarState === "open" && "New thread"}
          </button>
        </div>

        {/* Search — only when open */}
        {sidebarState === "open" && (
          <div className="px-3 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search"
                className="w-full bg-muted/50 border border-border rounded-md pl-8 pr-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="input-sidebar-search"
              />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 nice-scroll">
          {sidebarState === "open" ? (
            <>
              <SidebarSection label="Workspace">
                <SidebarItem icon={<Folder className="w-3.5 h-3.5" />} label="Personal" active />
                <SidebarItem icon={<Folder className="w-3.5 h-3.5" />} label="Acquisitions" />
                <SidebarItem icon={<Folder className="w-3.5 h-3.5" />} label="Editorial" />
              </SidebarSection>

              <SidebarSection label="Recent threads">
                {EXAMPLE_CONVERSATIONS.map((c) => (
                  <button key={c.id} className="w-full text-left rounded-md px-2 py-1.5 hover-elevate group" data-testid={`item-conversation-${c.id}`}>
                    <div className="text-xs text-foreground/90 truncate">{c.title}</div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 mt-0.5">{c.updatedLabel}</div>
                  </button>
                ))}
              </SidebarSection>

              <SidebarSection label="Saved workflows">
                {SAVED_WORKFLOWS.map((w) => (
                  <button key={w.id} onClick={() => onModeChange("orchestrate")} className="w-full text-left rounded-md px-2 py-1.5 hover-elevate flex items-start gap-2" data-testid={`item-workflow-${w.id}`}>
                    <GitBranch className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-foreground/90 truncate">{w.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{w.description}</div>
                    </div>
                  </button>
                ))}
              </SidebarSection>
            </>
          ) : (
            /* Icon rail — just mode shortcuts */
            <div className="flex flex-col items-center gap-1 pt-1">
              {[
                { icon: <MessageSquare className="w-4 h-4" />, m: "chat" as const, label: "Chat" },
                { icon: <Layers className="w-4 h-4" />, m: "compare" as const, label: "Compare" },
                { icon: <GitBranch className="w-4 h-4" />, m: "orchestrate" as const, label: "Orchestrate" },
                { icon: <LayoutGrid className="w-4 h-4" />, m: "workspace" as const, label: "Workspace" },
                { icon: <FileText className="w-4 h-4" />, m: "documents" as const, label: "Docs" },
              ].map(({ icon, m, label }) => (
                <button
                  key={m}
                  onClick={() => onModeChange(m)}
                  title={label}
                  className={`w-9 h-9 flex items-center justify-center rounded-md hover-elevate transition-colors ${mode === m ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          )}
        </nav>

        <div className="border-t border-border p-3">
          {auth.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover-elevate" data-testid="button-account" title={auth.user.name || auth.user.email}>
                  <Avatar email={auth.user.email} image={auth.user.image} name={auth.user.name} />
                  {sidebarState === "open" && (
                    <>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-xs font-medium truncate">{auth.user.name || auth.user.email.split("@")[0]}</div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{auth.hasKey ? "BYOK" : "No key"}</div>
                      </div>
                      <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">{auth.user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setLocation("/settings/keys")} data-testid="menu-keys">
                  <Key className="w-3.5 h-3.5 mr-2" /> API key{auth.hasKey ? ` \u2022 ****${auth.keyLastFour}` : " \u2014 not set"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLocation("/settings/usage")} data-testid="menu-usage">
                  <Sparkles className="w-3.5 h-3.5 mr-2" /> Usage
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setFeedbackOpen(true)}>
                  <MessageCircle className="w-3.5 h-3.5 mr-2" /> Send feedback
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => auth.signOut()} data-testid="menu-signout">
                  <LogOut className="w-3.5 h-3.5 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={() => auth.openSignIn()}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover-elevate"
              data-testid="button-signin-sidebar"
              title="Sign in"
            >
              <div className="w-6 h-6 rounded-full border border-border bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
                G
              </div>
              {sidebarState === "open" && (
                <div className="flex-1 text-left min-w-0">
                  <div className="text-xs font-medium truncate">Sign in</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Demo mode</div>
                </div>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* TOP BAR */}
        <header className={`border-b border-border flex items-center px-3 gap-2 shrink-0 min-w-0 transition-all duration-200 overflow-hidden ${headerCollapsed ? "h-0 border-b-0" : "h-12"}`}>
          <button
            onClick={cycleSidebar}
            className="p-1.5 rounded-md hover-elevate text-muted-foreground"
            aria-label="Toggle sidebar"
            data-testid="button-sidebar-toggle"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Mode tabs — hidden on mobile (replaced by bottom nav) */}
          <div className="hidden sm:flex items-center bg-card/80 border border-border rounded-md p-0.5 gap-0.5 min-w-0 overflow-x-auto no-scrollbar">
            <ModeTab active={mode === "chat"} onClick={() => onModeChange("chat")} icon={<MessageSquare className="w-3 h-3" />} label="Chat" testId="tab-chat" />
            <ModeTab active={mode === "compare"} onClick={() => onModeChange("compare")} icon={<Layers className="w-3 h-3" />} label="Compare" testId="tab-compare" />
            <ModeTab active={mode === "orchestrate"} onClick={() => onModeChange("orchestrate")} icon={<GitBranch className="w-3 h-3" />} label="Orchestrate" testId="tab-orchestrate" />
            <ModeTab active={mode === "workspace"} onClick={() => onModeChange("workspace")} icon={<LayoutGrid className="w-3 h-3" />} label="Workspace" testId="tab-workspace" />
            <ModeTab active={mode === "documents"} onClick={() => onModeChange("documents")} icon={<FileText className="w-3 h-3" />} label="Docs" testId="tab-documents" />
          </div>
          {/* Mobile: show current mode label */}
          {isMobile && (
            <span className="text-sm font-medium capitalize">{mode}</span>
          )}

          <div className="flex-1" />

          {mode_ === "mock" && (
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border ${theme === "dark" ? "text-amber-500 border-amber-500/30 bg-amber-500/10" : "text-amber-700 border-amber-500/40 bg-amber-50"}`}
              data-testid="badge-demo-mode"
              title="Responses are mocked. Sign in and add an OpenRouter key to use real models."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="hidden sm:inline">Demo mode</span>
            </span>
          )}
          {auth.user && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono tracking-wider text-muted-foreground border border-border bg-card/60 px-2 py-0.5 rounded-md"
              data-testid="chip-spend"
              title={`Daily cap: $${(auth.user.dailySpendCapUsd ?? 5).toFixed(2)}`}
            >
              ${auth.todaySpendUsd.toFixed(2)} today
            </span>
          )}
          <button
            onClick={() => setFeedbackOpen(true)}
            className="hidden md:inline-flex text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover-elevate"
            data-testid="button-send-feedback"
          >
            Feedback
          </button>
          {!auth.user && (
            <button
              onClick={() => auth.openSignIn()}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover-elevate-2"
              data-testid="button-signin-nav"
            >
              Sign in
            </button>
          )}
          <button
            onClick={() => setLocation("/pricing")}
            className="hidden sm:inline-flex text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover-elevate"
            data-testid="button-pricing"
          >
            Pricing
          </button>
          <button
            onClick={() => setHeaderCollapsed(true)}
            className="hidden sm:inline-flex p-1.5 rounded-md hover-elevate text-muted-foreground/50 hover:text-muted-foreground"
            aria-label="Collapse toolbar"
            title="Collapse toolbar"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </button>
        </header>
        <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

        {/* Floating pill — shown when header is collapsed */}
        {headerCollapsed && !isMobile && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-card/90 backdrop-blur border border-border rounded-full px-1.5 py-1 shadow-md">
            <button onClick={() => onModeChange("chat")} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${mode === "chat" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><MessageSquare className="w-3 h-3" />Chat</button>
            <button onClick={() => onModeChange("compare")} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${mode === "compare" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><Layers className="w-3 h-3" />Compare</button>
            <button onClick={() => onModeChange("orchestrate")} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${mode === "orchestrate" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><GitBranch className="w-3 h-3" />Orchestrate</button>
            <button onClick={() => onModeChange("workspace")} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${mode === "workspace" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid className="w-3 h-3" />Workspace</button>
            <div className="w-px h-4 bg-border mx-0.5" />
            <button onClick={() => setHeaderCollapsed(false)} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover-elevate" title="Expand toolbar"><ChevronsUpDown className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* CONTENT + RIGHT RAIL */}
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
          {rightRail && (
            <aside className="w-72 border-l border-border bg-sidebar/40 hidden lg:flex flex-col overflow-hidden">
              {rightRail}
            </aside>
          )}
        </div>
      </main>

      {/* MOBILE BOTTOM NAV */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 h-14 bg-background border-t border-border flex items-stretch">
          <BottomNavItem icon={<MessageSquare className="w-5 h-5" />} label="Chat" active={mode === "chat"} onClick={() => onModeChange("chat")} testId="mobile-tab-chat" />
          <BottomNavItem icon={<Layers className="w-5 h-5" />} label="Compare" active={mode === "compare"} onClick={() => onModeChange("compare")} testId="mobile-tab-compare" />
          <BottomNavItem icon={<GitBranch className="w-5 h-5" />} label="Orchestrate" active={mode === "orchestrate"} onClick={() => onModeChange("orchestrate")} testId="mobile-tab-orchestrate" />
          <BottomNavItem icon={<FileText className="w-5 h-5" />} label="Docs" active={mode === "documents"} onClick={() => onModeChange("documents")} testId="mobile-tab-documents" />
          <BottomNavItem icon={<Menu className="w-5 h-5" />} label="Menu" active={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} testId="mobile-tab-menu" />
        </nav>
      )}
    </div>
  );
}

function ModeTab({ active, onClick, icon, label, testId }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; testId: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? "bg-background text-foreground shadow-sm border border-border"
          : "text-muted-foreground hover:text-foreground"
      }`}
      data-testid={testId}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SidebarSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="px-2 mb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Avatar({ email, image, name }: { email: string; image?: string | null; name?: string | null }) {
  if (image) {
    return (
      <img
        src={image}
        alt=""
        className="w-6 h-6 rounded-full object-cover border border-border"
        referrerPolicy="no-referrer"
      />
    );
  }
  const letter = (name || email)[0]?.toUpperCase() || "?";
  return (
    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-[10px] font-semibold text-background">
      {letter}
    </div>
  );
}

function SidebarItem({ icon, label, active = false }: { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <button
      className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover-elevate ${
        active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function BottomNavItem({ icon, label, active, onClick, testId }: { icon: ReactNode; label: string; active: boolean; onClick: () => void; testId: string }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
