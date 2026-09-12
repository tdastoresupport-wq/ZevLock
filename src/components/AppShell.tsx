"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { Wordmark } from "@/components/Wordmark";
import { LicenseScreen } from "@/components/LicenseScreen";
import { WelcomeModal } from "@/components/modals";
import { HomeTab } from "@/components/HomeTab";
import { AccountTab } from "@/components/AccountTab";
import { FunctionTab, persistMany, persistToggle } from "@/components/FunctionTab";
import { RealtimeTab } from "@/components/RealtimeTab";
import { api, fetchWithTimeout, storageGet } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { DUR, EASE_OUT } from "@/lib/motion";
import type { ActivityEvent, FunctionKey, FunctionStates, LicenseStatusResponse } from "@/lib/types";

const ACT_KEY = "zev_activity";

function loadActivity(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(ACT_KEY);
    if (raw) return JSON.parse(raw) as ActivityEvent[];
  } catch { /* ignore */ }
  // No fake seeds — only real events generated on this device are shown.
  return [];
}

export default function AppShell() {
  const [booting, setBooting] = useState(true);
  const [status, setStatus] = useState<LicenseStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [savingAll, setSavingAll] = useState(false);
  // Per-key pending intents: different keys may fly concurrently (the server
  // merges disjoint columns); the same key stays serialized while pending.
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<FunctionKey>>(new Set());
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [welcome, setWelcome] = useState(false);
  const flightRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const pushActivity = useCallback((a: ActivityEvent) => {
    setActivity((prev) => {
      const next = [a, ...prev].slice(0, 50);
      try { localStorage.setItem(ACT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const deviceId = getDeviceId();
      const t = storageGet("zev_token");
        const headers: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
        // Bounded: a hanging API can never hold startup hostage.
        const res = await fetchWithTimeout(`/api/license/status?device_identifier=${encodeURIComponent(deviceId)}`, { headers });
      if (res.status === 401 || res.status === 403) {
        api.clearToken();
        setStatus(null);
        return false;
      }
      if (!res.ok) throw new Error("Failed to load session");
      setStatus((await res.json()) as LicenseStatusResponse);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      return false;
    }
  }, []);

  useEffect(() => {
    setActivity(loadActivity());
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Splash dismissal is driven by a bounded timer, never by the network:
    // the animation is presentation-only; refresh() carries its own abort
    // timeout, so BOOTING always reaches READY (dashboard or license screen).
    const finish = () => {
      const wait = Math.max(0, 900 - (Date.now() - started));
      timer = setTimeout(() => { if (mountedRef.current) setBooting(false); }, wait);
    };
    const stored = storageGet("zev_token");
    if (!stored) {
      finish();
    } else {
      (async () => {
        const ok = await refresh();
        if (!mountedRef.current) return;
        if (ok) setWelcome(true); // welcome popup on every login / session boot
        finish();
      })();
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [refresh]);

  // Re-sync authoritative state whenever the tab becomes visible again,
  // so a toggle-then-navigate-away sequence can never leave stale UI.
  // Also pauses the Aurora ambient loop while hidden (paint savings).
  useEffect(() => {
    const onVis = () => {
      const hidden = document.visibilityState !== "visible";
      document.body.classList.toggle("zev-paused", hidden);
      if (!hidden && localStorage.getItem("zev_token")) void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  /** Authoritative function-state refetch (reconciles stale optimistic views). */
  const refetchFunctions = useCallback(async () => {
    try {
      const t = storageGet("zev_token");
      const headers: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
      const res = await fetchWithTimeout(`/api/functions`, { headers });
      if (!res.ok) return;
      const data = (await res.json()) as { functions: FunctionStates };
      if (mountedRef.current && data.functions) {
        setStatus((s) => (s ? { ...s, functions: data.functions } : s));
      }
    } catch { /* reconcile is best-effort */ }
  }, []);

  /**
   * Mutation gate: every toggle intent gets a sequence number. If a newer
   * intent started while this flight was in the air, this response may be
   * stale → reconcile from the server instead of trusting it.
   */
  async function mutate<T>(fn: () => Promise<T>): Promise<T> {
    const id = ++flightRef.current;
    try {
      return await fn();
    } finally {
      if (id !== flightRef.current && mountedRef.current) await refetchFunctions();
    }
  }

  async function handleToggle(key: FunctionKey, next: boolean) {
    if (!status || pendingKeys.has(key)) return;
    setPendingKeys((prev) => new Set(prev).add(key));
    try {
      await mutate(() => persistToggle(key, next, status.functions, (f: FunctionStates) => {
        if (mountedRef.current) setStatus((s) => (s ? { ...s, functions: f } : s));
      }, pushActivity));
    } finally {
      if (mountedRef.current) {
        setPendingKeys((prev) => {
          const nextSet = new Set(prev);
          nextSet.delete(key);
          return nextSet;
        });
      }
    }
  }

  async function handleToggleAll(next: boolean) {
    if (!status) return;
    const full = Object.fromEntries(
      (Object.keys(status.functions) as FunctionKey[]).map((k) => [k, next])
    ) as FunctionStates;
    setSavingAll(true);
    try {
      await mutate(() => persistMany(full, status.functions, (f: FunctionStates) => {
        if (mountedRef.current) setStatus((s) => (s ? { ...s, functions: f } : s));
      }, pushActivity));
    } finally {
      if (mountedRef.current) setSavingAll(false);
    }
  }

  async function handleResetDevice() {
    try { await api.deviceReset(); } catch { /* ignore */ }
    api.clearToken();
    setStatus(null);
    setWelcome(false);
    setTab("home");
  }

  async function handleLogout() {
    try { await api.logout(); } catch { /* ignore */ }
    api.clearToken();
    setStatus(null);
    setWelcome(false);
    setTab("home");
  }

  if (booting) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center gap-4 overflow-hidden">
        <div className="zev-aurora" aria-hidden="true" />
        <div className="zev-hero-glow" />
        <div className="zev-splash-logo flex flex-col items-center">
          <Wordmark size="lg" />
        </div>
      </div>
    );
  }

  if (!status) {
    // Session invalid/expired/absent → license-first flow.
    // A failed boot refresh surfaces here as a retryable notice (DEGRADED),
    // never as a permanent splash.
    return (
      <LicenseScreen
        onActivated={(s) => { setStatus(s); setError(null); setWelcome(true); }}
        notice={error}
        onRetry={() => void refresh()}
      />
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="zev-top-pad min-h-dvh px-4 pb-28">
        <div className="zev-aurora" aria-hidden="true" />
        <AnimatePresence mode="wait">
          <motion.main
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: DUR.fast, ease: EASE_OUT }}
          >
            {tab === "home" && (
              <HomeTab
                status={status}
                loading={false}
                error={error}
                activity={activity}
                pendingKeys={pendingKeys}
                onRetry={() => void refresh()}
                onLogout={() => void handleLogout()}
                onOpenControls={() => setTab("function")}
                onToggle={async (k, n) => { await handleToggle(k, n); }}
              />
            )}
            {tab === "function" && (
              <FunctionTab
                functions={status.functions}
                pendingKeys={pendingKeys}
                savingAll={savingAll}
                onToggle={async (k, n) => { await handleToggle(k, n); }}
                onToggleAll={async (n) => { await handleToggleAll(n); }}
              />
            )}
            {tab === "realtime" && (
              <RealtimeTab status={status} loading={false} error={error} activity={activity} onSync={() => refresh()} />
            )}
            {tab === "account" && (
              <AccountTab
                status={status}
                loading={false}
                error={error}
                onRetry={() => void refresh()}
                onLogout={() => void handleLogout()}
                onResetDevice={() => handleResetDevice()}
              />
            )}
          </motion.main>
        </AnimatePresence>
        <BottomNav tab={tab} onChange={setTab} />
        <AnimatePresence>
          {welcome && (
            <WelcomeModal
              key="welcome"
              plan={status.license.plan}
              device={`${status.device.platform} · ${status.device.status}`}
              onEnter={() => setWelcome(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
