import { useState } from "react";
import { X, MessageCircle } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

// In-memory dismissal — preview sandbox blocks localStorage. Banner re-shows on hard reload.
let __betaBannerDismissed = false;

export function BetaBanner() {
  const [dismissed, setDismissed] = useState(__betaBannerDismissed);
  const { theme } = useTheme();
  const dark = theme === "dark";
  if (dismissed) return null;

  const dismiss = () => {
    __betaBannerDismissed = true;
    setDismissed(true);
  };

  const openFeedback = () => {
    // Navigate into the app and trigger the global feedback modal there.
    if (typeof window !== "undefined") {
      const onApp = window.location.hash.startsWith("#/app");
      if (!onApp) {
        window.location.hash = "#/app";
      }
      // Defer so AppShell mounts before we fire the event.
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("conductor:open-feedback"));
      }, onApp ? 0 : 250);
    }
  };

  const text = dark ? "text-amber-100" : "text-amber-800";
  const subText = dark ? "text-amber-200/70" : "text-amber-700/80";
  const btnText = dark ? "text-amber-100" : "text-amber-800";
  const border = dark ? "border-amber-400/40" : "border-amber-600/40";
  const bg = dark ? "bg-amber-500/10" : "bg-amber-50";
  const bannerBorder = dark ? "border-amber-500/30" : "border-amber-300";

  return (
    <div
      className={`relative w-full ${bg} border-b ${bannerBorder} ${text}`}
      data-testid="banner-beta-preview"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 sm:px-6 py-2.5 text-sm">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
        <p className="flex-1 leading-snug">
          <span className="font-medium">Beta UX preview</span>
          <span className={subText}>
            {" "}— responses are mocked. Click around, break things, then send notes.
          </span>
        </p>
        <button
          onClick={openFeedback}
          className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${border} hover:bg-amber-500/20 ${btnText} font-medium text-xs transition-colors`}
          data-testid="button-banner-feedback"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Send feedback
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss banner"
          className={`p-1 rounded-md hover:bg-amber-500/20 ${subText} hover:${text} transition-colors flex-shrink-0`}
          data-testid="button-banner-dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
