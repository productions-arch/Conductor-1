/**
 * auth-store — current-user state for the client.
 *
 * - Reads /api/me on mount. If we get a user back, we toggle the gateway to
 *   "live" mode (when both a session and an OpenRouter key are present).
 * - Exposes `requireRealModel(reason)` — called by send buttons. If the user
 *   is logged out, opens the sign-in modal. If logged in without a key,
 *   opens the keys modal. Returns true if real models are usable now.
 * - Surfaces today's spend so the nav chip can render `$0.12 today`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setGatewayMode, getGatewayMode } from "./ai-gateway";

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  provider?: string;
  dailySpendCapUsd?: number;
}

interface AuthState {
  user: AuthUser | null;
  hasKey: boolean;
  keyLastFour: string | null;
  todaySpendUsd: number;
  loading: boolean;
  /** When user wants to use real models, the modal logic */
  signInModalOpen: boolean;
  signInReason: string | null;
  keyModalOpen: boolean;
  /** Cached providers status from /api/auth/providers */
  providers: { google: boolean; apple: boolean };
}

interface AuthActions {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  openSignIn: (reason?: string) => void;
  closeSignIn: () => void;
  openKeyModal: () => void;
  closeKeyModal: () => void;
  /** Returns true if real models are usable; otherwise opens the right modal. */
  requireRealModel: (reason?: string) => boolean;
  /** Toggle live vs demo on demand (used by the "Use real models" switch). */
  setUseRealModels: (live: boolean) => void;
  applyTodaySpend: (delta: number) => void;
  /** Update spend cap on the server */
  setDailyCap: (cap: number) => Promise<void>;
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    hasKey: false,
    keyLastFour: null,
    todaySpendUsd: 0,
    loading: true,
    signInModalOpen: false,
    signInReason: null,
    keyModalOpen: false,
    providers: { google: true, apple: false },
  });

  const refresh = useCallback(async () => {
    try {
      const [meR, provR] = await Promise.all([
        fetch("/api/me", { credentials: "include" }),
        fetch("/api/auth/providers", { credentials: "include" }),
      ]);
      const me = meR.ok ? await meR.json() : { user: null };
      const provs = provR.ok ? await provR.json() : { google: true, apple: false };
      setState((s) => ({
        ...s,
        user: me.user ?? null,
        hasKey: !!me.hasKey,
        keyLastFour: me.keyLastFour ?? null,
        todaySpendUsd: Number(me.todaySpendUsd ?? 0),
        loading: false,
        providers: { google: !!provs.google, apple: !!provs.apple },
      }));
      // If signed in AND key present, switch to live; otherwise keep mock.
      if (me.user && me.hasKey) {
        setGatewayMode("live");
      } else {
        setGatewayMode("mock");
      }
    } catch (err) {
      console.error("auth refresh", err);
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
    setGatewayMode("mock");
    setState((s) => ({ ...s, user: null, hasKey: false, keyLastFour: null, todaySpendUsd: 0 }));
  }, []);

  const openSignIn = useCallback((reason?: string) => {
    setState((s) => ({ ...s, signInModalOpen: true, signInReason: reason ?? null }));
  }, []);
  const closeSignIn = useCallback(() => {
    setState((s) => ({ ...s, signInModalOpen: false }));
  }, []);
  const openKeyModal = useCallback(() => {
    setState((s) => ({ ...s, keyModalOpen: true }));
  }, []);
  const closeKeyModal = useCallback(() => {
    setState((s) => ({ ...s, keyModalOpen: false }));
  }, []);

  const setUseRealModels = useCallback((live: boolean) => {
    if (!live) {
      setGatewayMode("mock");
      return;
    }
    // Need both session and key
    setState((s) => {
      if (!s.user) {
        return { ...s, signInModalOpen: true, signInReason: "Sign in to use real models." };
      }
      if (!s.hasKey) {
        return { ...s, keyModalOpen: true };
      }
      setGatewayMode("live");
      return s;
    });
  }, []);

  const requireRealModel = useCallback((reason?: string) => {
    // Read fresh state via setState's closure
    let ok = false;
    setState((s) => {
      if (!s.user) {
        return { ...s, signInModalOpen: true, signInReason: reason ?? "Sign in to send real prompts." };
      }
      if (!s.hasKey) {
        return { ...s, keyModalOpen: true };
      }
      // Both present — ensure mode is live
      if (getGatewayMode() !== "live") setGatewayMode("live");
      ok = true;
      return s;
    });
    return ok;
  }, []);

  const applyTodaySpend = useCallback((delta: number) => {
    setState((s) => ({ ...s, todaySpendUsd: s.todaySpendUsd + delta }));
  }, []);

  const setDailyCap = useCallback(async (cap: number) => {
    await fetch("/api/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailySpendCapUsd: cap }),
    });
    setState((s) => (s.user ? { ...s, user: { ...s.user, dailySpendCapUsd: cap } } : s));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      signOut,
      openSignIn,
      closeSignIn,
      openKeyModal,
      closeKeyModal,
      requireRealModel,
      setUseRealModels,
      applyTodaySpend,
      setDailyCap,
    }),
    [state, refresh, signOut, openSignIn, closeSignIn, openKeyModal, closeKeyModal, requireRealModel, setUseRealModels, applyTodaySpend, setDailyCap],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
