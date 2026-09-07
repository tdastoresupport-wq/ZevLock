"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { LicenseScreen } from "@/components/LicenseScreen";
import { HomeTab } from "@/components/HomeTab";
import { FunctionTab, persistToggle } from "@/components/FunctionTab";
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
  return [
    { id: "seed-1", at: "22:31:04", label: "AimLock Head enabled", kind: "enabled" },
    { id: "seed-2", at: "22:31:17", label: "Stability Assist enabled", kind: "enabled" },
    { id: "seed-3", at: "22:33:02", label: "Aim Hold disabled", kind: "disabled" },
  ];
}

export default function AppShell() {
  const [booting, setBooting] = useState(true);
  const [status, setStatus] = useState<LicenseStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [savingKey, setSavingKey] = useState<FunctionKey | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

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
        return;
      }
      if (!res.ok) throw new Error("Failed to load session");
      setStatus((await res.json()) as LicenseStatusResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    setActivity(loadActivity());
    (async () => {
      if (localStorage.getItem("zev_token")) await refresh();
      setBooting(false);
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

  async function handleLogout() {
    try { await api.logout(); } catch { /* ignore */ }
    api.clearToken();
    setStatus(null);
    setTab("home");
  }

  if (booting) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-lg font-black tracking-[0.3em]">ZEV</p>
      </div>
    );
  }

  if (!status) {
    // Session invalid/expired/absent → license-first flow.
    return <LicenseScreen onActivated={(s) => { setStatus(s); setError(null); }} />;
  }

  return (
    <div className="zev-top-pad min-h-dvh px-4 pb-28">
      <AnimatePresence mode="wait">
        <motion.main
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16 }}
        >
          {tab === "home" && (
            <HomeTab status={status} loading={false} error={error} activity={activity} onRetry={() => void refresh()} onLogout={() => void handleLogout()} />
          )}
          {tab === "function" && (
            <FunctionTab
              functions={status.functions}
              savingKey={savingKey}
              pushActivity={pushActivity}
              onToggle={async (k, n) => { await handleToggle(k, n); }}
            />
          )}
          {tab === "realtime" && (
            <RealtimeTab status={status} loading={false} error={error} activity={activity} onRetry={() => void refresh()} />
          )}
        </motion.main>
      </AnimatePresence>
      <BottomNav tab={tab} onChange={setTab} />
    </div>
  );
}
