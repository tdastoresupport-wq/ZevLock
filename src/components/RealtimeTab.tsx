"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Power, RefreshCw } from "lucide-react";
import { Card, ErrorState, SectionHeader, Skeleton, StatusDot } from "./ui";
import { fmtCountdown, fmtDate, timeAgo } from "@/lib/format";
import { playClick } from "@/lib/sound";
import { subscribeOnline } from "@/lib/telemetry";
import { FUNCTIONS, type ActivityEvent, type FunctionStates, type LicenseStatusResponse } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Realtime tab — live APP telemetry only (session, events, toggles). No game/hardware data, ever. */
export function RealtimeTab({
  status, loading, error, activity, onRetry,
}: {
  status: LicenseStatusResponse | null;
  loading: boolean;
  error: string | null;
  activity: ActivityEvent[];
  onRetry: () => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [syncing, setSyncing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    const unsub = subscribeOnline(setOnline);
    return () => { clearInterval(t); unsub(); };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-44 w-full !rounded-[22px]" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (error || !status) return <ErrorState message={error ?? "Couldn't load realtime status."} onRetry={onRetry} />;

  const licenseOk = status.license.status === "ACTIVE";
  const remaining = new Date(status.session_expires_at).getTime() - nowMs;
  const onCount = FUNCTIONS.filter((f) => status.functions[f.key]).length;
  const last = activity[0];
  const bars = activity.slice(0, 24);

  function sync() {
    playClick();
    setSyncing(true);
    onRetry();
    setTimeout(() => setSyncing(false), 900);
  }

  return (
    <div className="space-y-5">
      <div className="pt-1 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-black">Realtime</h1>
          <p className="mt-0.5 text-[12px] text-slate-400">Live status.</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={sync}
          aria-label="Sync status"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-purple-200"
        >
          <motion.span animate={syncing ? { rotate: 360 } : { rotate: 0 }} transition={{ duration: 0.8, ease: "easeInOut" }}>
            <RefreshCw size={18} />
          </motion.span>
        </motion.button>
      </div>

      {/* Live session hero */}
      <div className="relative overflow-hidden rounded-[22px] border border-purple-300/20 bg-gradient-to-b from-violet-600/15 to-transparent px-5 py-5 text-center">
        <div className="zev-hero-glow" />
        <p className="flex items-center justify-center gap-2 text-[11px] font-black tracking-[0.24em] text-slate-300">
          <span className={online ? "zev-live-dot" : "dot bg-amber-400"} aria-hidden="true" />
          {online ? "LIVE SESSION" : "OFFLINE — SHOWING LAST SYNC"}
        </p>
        <p className="tnum mt-2 text-[42px] font-black leading-none tracking-tight" aria-hidden="true">
          {mounted ? fmtCountdown(remaining) : "––:––:––"}
        </p>
        <p className="sr-only">Session expires {fmtDate(status.session_expires_at)}</p>
        <p className="mt-2 text-[12px] text-slate-400">
          {licenseOk ? "License valid" : status.license.status} · expires {fmtDate(status.session_expires_at)}
        </p>
      </div>

      {/* Real telemetry counters */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { v: String(activity.length), l: "Events" },
          { v: `${onCount}/${FUNCTIONS.length}`, l: "Active" },
          { v: last?.iso ? timeAgo(last.iso).replace(" ago", "") : "—", l: "Last change" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-white/10 bg-white/[0.02] px-2 py-3">
            <p className="tnum truncate text-[17px] font-black">{s.v}</p>
            <p className="mt-0.5 text-[10px] font-bold tracking-[0.16em] text-slate-500">{s.l.toUpperCase()}</p>
          </div>
        ))}
      </div>

      {/* Event pulse — bars drawn from real toggle events */}
      <div>
        <SectionHeader kicker="EVENT PULSE · THIS DEVICE" />
        <Card className="!p-3.5">
          {bars.length === 0 ? (
            <p className="py-2 text-center text-[12px] text-slate-500">Nothing here yet — activity appears as you use the app.</p>
          ) : (
            <div className="flex h-16 items-end gap-1" aria-hidden="true">
              {bars.map((b, i) => (
                <motion.span
                  key={b.id}
                  layout
                  initial={{ scaleY: 0.2, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 26 }}
                  className={cn(
                    "min-w-0 flex-1 origin-bottom rounded-sm",
                    b.kind === "enabled" ? "bg-purple-400/90" : "bg-slate-600/70"
                  )}
                  style={{ height: `${Math.max(14, 100 - i * 4)}%` }}
                />
              ))}
            </div>
          )}
          {/* Live feed */}
          <div className="mt-3 space-y-2">
            <AnimatePresence initial={false}>
              {activity.slice(0, 4).map((a) => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="flex items-center gap-2 text-[12.5px]"
                >
                  <Power size={12} className={a.kind === "enabled" ? "shrink-0 text-emerald-300" : "shrink-0 text-slate-500"} />
                  <span className="min-w-0 flex-1 truncate text-slate-200">{a.label} · {a.action ?? ""}</span>
                  <span className="tnum shrink-0 font-mono text-[10.5px] text-slate-500">
                    {a.iso ? timeAgo(a.iso) : a.at}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Card>
      </div>

      {/* Compact function grid */}
      <div>
        <SectionHeader kicker="FUNCTION STATUS" />
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {FUNCTIONS.map((f) => {
            const on = status.functions[f.key as keyof FunctionStates];
            return (
              <div
                key={f.key}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-2.5 py-2",
                  on ? "border-purple-300/25 bg-purple-500/[0.07]" : "border-white/[0.07] bg-white/[0.015]"
                )}
              >
                {on ? <span className="zev-live-dot !h-[7px] !w-[7px]" aria-hidden="true" /> : <StatusDot on={false} />}
                <span className={cn("min-w-0 flex-1 truncate text-[12px] font-bold", on ? "text-slate-100" : "text-slate-500")}>
                  {f.name}
                </span>
                <span className={cn("tnum text-[10px] font-black", on ? "text-emerald-300" : "text-slate-600")}>
                  {on ? "ON" : "OFF"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="pb-2 text-center text-[11px] text-slate-600">
        App telemetry only
      </p>
    </div>
  );
}
