import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth-store";
import { Link } from "wouter";

export function SignInModal() {
  const { signInModalOpen, closeSignIn, signInReason, providers } = useAuth();

  // Where to return after sign-in. We use the current hash route so users
  // land back at the same in-app screen.
  const returnTo = typeof window !== "undefined"
    ? (window.location.hash?.replace(/^#/, "") || "/app")
    : "/app";

  return (
    <Dialog open={signInModalOpen} onOpenChange={(o) => !o && closeSignIn()}>
      <DialogContent className="sm:max-w-sm">
        <div className="flex flex-col items-center text-center gap-3 pt-2">
          <div className="rounded-md p-2 bg-card border border-border">
            <Logo size={28} />
          </div>
          <DialogTitle className="text-lg font-semibold tracking-tight">Sign in to Conductor</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
            {signInReason ?? "Sign in to send real prompts. Anyone can explore the demo without an account."}
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          {providers.google && (
            <a
              href={`/api/auth/signin/google?returnTo=${encodeURIComponent(returnTo)}`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card hover-elevate-2 px-4 py-2.5 text-sm font-medium"
              data-testid="button-signin-google"
            >
              <GoogleGlyph />
              Continue with Google
            </a>
          )}
          {providers.apple && (
            <a
              href={`/api/auth/signin/apple?returnTo=${encodeURIComponent(returnTo)}`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card hover-elevate-2 px-4 py-2.5 text-sm font-medium"
              data-testid="button-signin-apple"
            >
              <AppleGlyph />
              Continue with Apple
            </a>
          )}
        </div>

        <p className="mt-4 text-[10px] text-muted-foreground text-center leading-relaxed">
          By signing in you agree to our{" "}
          <Link href="/legal/terms" className="underline hover:text-foreground">Terms</Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.05-3.72 1.05-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.61 0 3.06.55 4.2 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M19.6 17.1c-.3.7-.7 1.4-1.2 2-.7.9-1.3 1.5-1.8 1.8-.7.5-1.5.7-2.4.7-.7 0-1.4-.2-2.4-.5-1-.4-1.8-.5-2.5-.5-.8 0-1.6.2-2.6.5-.9.4-1.7.6-2.2.6-.9 0-1.7-.3-2.4-.8C1.3 20.4.6 19.6 0 18.6c-.6-1-1.1-2.2-1.4-3.5-.4-1.5-.6-3-.6-4.4 0-1.6.4-3 1.1-4.2.5-1 1.3-1.7 2.2-2.3.9-.5 2-.8 3-.8.7 0 1.6.2 2.7.6 1.1.4 1.8.6 2.2.6.3 0 1.1-.2 2.4-.7 1.2-.4 2.2-.6 3-.5 2.3.2 4 1.1 5.1 2.7-2 1.2-3.1 3-3.1 5.2 0 1.7.6 3.1 1.9 4.3.6.5 1.2.9 1.9 1.2-.2.4-.3.9-.5 1.3ZM14.6 0c0 .2 0 .4 0 .6-.1 1.2-.5 2.2-1.4 3.2-1 1.1-2.3 1.8-3.6 1.7 0-.2 0-.4 0-.6 0-1.1.5-2.3 1.5-3.3.5-.5 1.1-1 1.8-1.3.7-.3 1.3-.4 1.9-.5 0 0 0 0 0 .2Z"/>
    </svg>
  );
}
