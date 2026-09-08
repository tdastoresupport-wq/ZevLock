"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { LicenseScreen } from "@/components/LicenseScreen";
import { WelcomeModal } from "@/components/modals";
import { HomeTab } from "@/components/HomeTab";
import { FunctionTab, persistMany, persistToggle } from "@/components/FunctionTab";
import { RealtimeTab } from "@/components/RealtimeTab";
import { api } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
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
  const [savingKey, setSavingKey] = useState<FunctionKey | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [welcome, setWelcome] = useState(false);

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
      const t = localStorage.getItem("zev_token");
        const headers: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
        const res = await fetch(`/api/license/status?device_identifier=${encodeURIComponent(deviceId)}`, { headers });
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
    (async () => {
      let ok = false;
      if (localStorage.getItem("zev_token")) ok = await refresh();
      if (ok) setWelcome(true); // welcome popup on every login / session boot
      // Startup animation beat (~900ms) before revealing the dashboard.
      const wait = Math.max(0, 900 - (Date.now() - started));
      setTimeout(() => setBooting(false), wait);
    })();
  }, [refresh]);

  async function handleToggle(key: FunctionKey, next: boolean) {
    if (!status) return;
    setSavingKey(key);
    try {
      await persistToggle(key, next, status.functions, (f: FunctionStates) => {
        setStatus((s) => (s ? { ...s, functions: f } : s));
      }, pushActivity);
    } finally {
      setSavingKey(null);
    }
  }

  async function handleToggleAll(next: boolean) {
    if (!status) return;
    const full = Object.fromEntries(
      (Object.keys(status.functions) as FunctionKey[]).map((k) => [k, next])
    ) as FunctionStates;
    setSavingAll(true);
    try {
      await persistMany(full, status.functions, (f: FunctionStates) => {
        setStatus((s) => (s ? { ...s, functions: f } : s));
      }, pushActivity);
    } finally {
      setSavingAll(false);
    }
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
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden">
        <div className="zev-hero-glow" />
        <div className="zev-splash-logo flex flex-col items-center">
          <p className="text-3xl font-black tracking-[0.32em]">ZEV</p>
          <p className="mt-2 text-[11px] font-bold tracking-[0.4em] text-purple-300">LOCK</p>
        </div>
      </div>
    );
  }

  if (!status) {
    // Session invalid/expired/absent → license-first flow.
    return <LicenseScreen onActivated={(s) => { setStatus(s); setError(null); setWelcome(true); }} />;
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="zev-top-pad min-h-dvh px-4 pb-28">
        <AnimatePresence mode="wait">
          <motion.main
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "home" && (
              <HomeTab
                status={status}
                loading={false}
                error={error}
                activity={activity}
                savingKey={savingKey}
                onRetry={() => void refresh()}
                onLogout={() => void handleLogout()}
                onOpenControls={() => setTab("function")}
                onToggle={async (k, n) => { await handleToggle(k, n); }}
              />
            )}
            {tab === "function" && (
              <FunctionTab
                functions={status.functions}
                savingKey={savingKey}
                savingAll={savingAll}
                onToggle={async (k, n) => { await handleToggle(k, n); }}
                onToggleAll={async (n) => { await handleToggleAll(n); }}
              />
            )}
            {tab === "realtime" && (
              <RealtimeTab status={status} loading={false} error={error} activity={activity} onRetry={() => void refresh()} />
            )}
          </motion.main>
        </AnimatePresence>
        <BottomNav tab={tab} onChange={setTab} />
        <AnimatePresence>
          {welcome && (
            <WelcomeModal
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
