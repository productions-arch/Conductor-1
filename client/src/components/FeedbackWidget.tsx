/**
 * Two pieces:
 *   - <MessageFeedback messageId/> — inline thumbs up/down for assistant messages.
 *   - <FeedbackModal /> — global "Send feedback" modal opened from the nav.
 */
import { useState } from "react";
import { ThumbsUp, ThumbsDown, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

async function submitFeedback(payload: {
  rating: number;
  comment?: string;
  isBugReport?: boolean;
  messageId?: string;
  pageContext?: string;
}) {
  await fetch("/api/feedback", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rating: payload.rating,
      comment: payload.comment || null,
      isBugReport: !!payload.isBugReport,
      messageId: payload.messageId ?? null,
      pageContext: payload.pageContext ?? null,
    }),
  });
}

export function MessageFeedback({ messageId }: { messageId?: string }) {
  const { toast } = useToast();
  const [voted, setVoted] = useState<null | 1 | -1>(null);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [bug, setBug] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function thumbsUp() {
    if (voted === 1) return;
    setVoted(1);
    try {
      await submitFeedback({ rating: 1, messageId });
      toast({ title: "Thanks — got it." });
    } catch {/* silent */}
  }

  async function send() {
    setSubmitting(true);
    try {
      await submitFeedback({ rating: -1, messageId, comment, isBugReport: bug });
      setVoted(-1);
      setOpen(false);
      setComment("");
      setBug(false);
      toast({ title: "Thanks — got it." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
      <button
        onClick={thumbsUp}
        className={`p-1 rounded-md hover-elevate ${voted === 1 ? "text-emerald-500" : "text-muted-foreground"}`}
        aria-label="Thumbs up"
        data-testid={`button-thumbs-up-${messageId ?? "msg"}`}
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`p-1 rounded-md hover-elevate ${voted === -1 ? "text-rose-500" : "text-muted-foreground"}`}
            aria-label="Thumbs down"
            data-testid={`button-thumbs-down-${messageId ?? "msg"}`}
          >
            <ThumbsDown className="w-3 h-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <div className="text-xs font-medium mb-1">What was off?</div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Optional — be as specific as you like."
            className="w-full text-xs bg-muted/50 border border-border rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <input type="checkbox" checked={bug} onChange={(e) => setBug(e.target.checked)} />
            Report as bug
          </label>
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setOpen(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={send}
              disabled={submitting}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover-elevate-2 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [bug, setBug] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function send() {
    setSubmitting(true);
    try {
      await submitFeedback({
        rating: 0,
        comment,
        isBugReport: bug,
        pageContext: typeof window !== "undefined" ? window.location.hash : undefined,
      });
      setComment("");
      setBug(false);
      onClose();
      toast({ title: "Thanks — got it." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="text-base font-semibold tracking-tight">Send feedback</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
          What's broken, confusing, or missing? Every note goes straight to Kane.
        </DialogDescription>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={5}
          placeholder="Anything on your mind…"
          className="w-full text-sm bg-muted/50 border border-border rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-ring mt-3"
        />
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground mt-2">
          <input type="checkbox" checked={bug} onChange={(e) => setBug(e.target.checked)} />
          Report as bug
        </label>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancel</button>
          <button
            onClick={send}
            disabled={submitting || !comment.trim()}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover-elevate-2 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
