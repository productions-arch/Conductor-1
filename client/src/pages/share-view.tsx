import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { Logo } from "@/components/Logo";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { modelById } from "@/lib/models";

interface ShareData {
  title: string;
  mode: string;
  snapshot: unknown;
  createdAt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  modelId?: string;
}

export default function ShareViewPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/share/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error === "expired" ? "This link has expired." : "Conversation not found.");
        }
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message));
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border sticky top-0 bg-background/80 backdrop-blur z-40">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2 hover-elevate rounded-md px-1.5 py-1 -ml-1.5">
            <Logo size={18} />
            <span className="font-semibold tracking-tight text-sm">Conductor</span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm text-muted-foreground truncate max-w-[200px]">
            {data?.title ?? "Shared conversation"}
          </span>
          <div className="flex-1" />
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover-elevate-2"
          >
            Try Conductor <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {!data && !error && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 flex items-center gap-3 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="mb-6">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                {data.mode} · shared {new Date(data.createdAt).toLocaleDateString()}
              </div>
              <h1 className="text-xl font-semibold tracking-tight">{data.title}</h1>
            </div>

            <ConversationView mode={data.mode} snapshot={data.snapshot} />
          </>
        )}
      </div>
    </div>
  );
}

function ConversationView({ mode, snapshot }: { mode: string; snapshot: unknown }) {
  const messages = Array.isArray(snapshot) ? (snapshot as ChatMessage[]) : [];

  if (mode === "chat") {
    return (
      <div className="space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
      </div>
    );
  }

  if (mode === "compare") {
    const cols = Array.isArray(snapshot) ? (snapshot as Array<{ modelId: string; output: string }>) : [];
    return (
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(cols.length, 3)}, 1fr)` }}>
        {cols.map((col, i) => {
          const model = modelById(col.modelId);
          return (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                {model.name}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{col.output}</p>
            </div>
          );
        })}
      </div>
    );
  }

  if (mode === "orchestrate") {
    const nodes = Array.isArray(snapshot) ? (snapshot as Array<{ label: string; modelId: string; output: string }>) : [];
    return (
      <div className="space-y-3">
        {nodes.map((node, i) => {
          const model = modelById(node.modelId);
          return (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium">{node.label}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{model.name}</span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{node.output}</p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      This shared content cannot be displayed.
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const model = message.modelId ? modelById(message.modelId) : null;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border"
        }`}
      >
        {!isUser && model && (
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
            {model.name}
          </div>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
