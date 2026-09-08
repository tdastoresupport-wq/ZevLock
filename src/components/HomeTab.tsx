"use client";

import { useState } from "react";
import { ChevronRight, LogOut, Power, Smartphone } from "lucide-react";
import { Card, ErrorState, Label, Skeleton, StatusDot } from "./ui";
import { Avatar, HeroArt } from "./HeroArt";
import { LicenseModal } from "./modals";
import { fmtDate, greeting, timeAgo } from "@/lib/format";
import type { ActivityEvent, FunctionGroup, LicenseStatusResponse } from "@/lib/types";
import { FUNCTIONS } from "@/lib/types";
import { cn } from "@/lib/cn";

const GROUPS: FunctionGroup[] = ["AIM ASSIST", "PERFORMANCE"];

export function HomeTab({
  status, loading, error, activity, onRetry, onLogout,
}: {
  status: LicenseStatusResponse | null;
  loading: boolean;
  error: string | null;
  activity: ActivityEvent[];
  onRetry: () => void;
  onLogout: () => void;
}) {
  const [showLicense, setShowLicense] = useState(false);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-44 w-full !rounded-[22px]" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (error || !status) return <ErrorState message={error ?? "Couldn't load your dashboard."} onRetry={onRetry} />;

  const onCount = Object.values(status.functions).filter(Boolean).length;
  const total = FUNCTIONS.length;
  const health = onCount === total ? "OPTIMAL" : onCount === 0 ? "IDLE" : "ACTIVE";

  return (
    <div className="space-y-4">
      {/* 1. Visual identity hero */}
      <HeroArt>
        <div className="flex items-center gap-3">
          <Avatar size={44} />
          <div className="min-w-0">
            <h1 className="text-[22px] font-black leading-none tracking-[0.14em]">ZEV</h1>
            <p className="mt-1 truncate text-[13px] text-slate-200">
              {greeting()} · Your device is fully protected
            </p>
          </div>
        </div>
      </HeroArt>

      {/* 2. License card */}
      <button onClick={() => setShowLicense(true)} className="zev-card block w-full p-4 text-left">
        <Label>LICENSE</Label>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="dot dot-on-green" />
          <span className="text-lg font-extrabold tracking-wide">{status.license.status}</span>
        </div>
        <p className="mt-1 font-mono text-xs text-slate-400">{status.license.key}</p>
        <span className="mt-2 flex items-center gap-1 text-[12px] font-bold text-purple-300">
          View license <ChevronRight size={14} />
        </span>
      </button>

      {/* 3. Premium badge + expiry */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col items-start justify-center">
          <Label>PLAN</Label>
          <span className="zev-badge-premium mt-2">♛ {status.license.plan}</span>
        </Card>
        <Card>
          <Label>EXPIRES</Label>
          <p className="mt-1.5 text-[15px] font-extrabold leading-tight">{fmtDate(status.license.expires_at)}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-400">
            <Smartphone size={13} className="text-purple-300" />
            {status.device.platform} · {status.device.status}
          </p>
        </Card>
      </div>

      {/* 4. System health */}
      <Card>
        <div className="flex items-center justify-between">
          <Label>SYSTEM STATUS</Label>
          <span className={cn("text-[13px] font-black tracking-widest", health === "OPTIMAL" ? "text-emerald-300" : "text-purple-200")}>
            {health}
          </span>
        </div>
        <p className="mt-1 text-[13px] text-slate-300">{onCount}/{total} systems active</p>
        <div className="zev-progress mt-2.5">
          <span style={{ width: `${Math.round((onCount / total) * 100)}%` }} />
        </div>
      </Card>

      {/* 5. Grouped quick status */}
      <Card>
        <Label>QUICK STATUS</Label>
        {GROUPS.map((g) => (
          <div key={g} className="mt-3 first:mt-2">
            <p className="text-[10px] font-bold tracking-[0.2em] text-slate-500">{g}</p>
            <div className="mt-1 space-y-1.5">
              {FUNCTIONS.filter((f) => f.group === g).map((f) => {
                const on = status.functions[f.key];
                return (
                  <div key={f.key} className="flex items-center justify-between text-[13px]">
                    <span className={on ? "font-semibold text-slate-100" : "text-slate-400"}>{f.name}</span>
                    <span className="flex items-center gap-1.5 font-bold">
                      <StatusDot on={on} />
                      <span className={on ? "text-emerald-300" : "text-slate-500"}>{on ? "ON" : "OFF"}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </Card>

      {/* 6. Recent activity (real events only) */}
      <Card>
        <Label>RECENT ACTIVITY</Label>
        <div className="mt-2 space-y-2.5">
          {activity.slice(0, 5).map((a) => (
            <div key={a.id} className="flex items-center gap-2.5">
              <span className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                a.kind === "enabled"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-white/5 text-slate-400"
              )}>
                <Power size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-100">{a.label}</p>
                <p className="text-[11px] text-slate-500">
                  {a.action ?? (a.kind === "enabled" ? "Enabled" : a.kind === "disabled" ? "Disabled" : "Info")}
                  {a.iso ? ` · ${timeAgo(a.iso)}` : a.at ? ` · ${a.at}` : ""}
                </p>
              </div>
            </div>
          ))}
          {activity.length === 0 && (
            <p className="text-[13px] text-slate-500">No activity yet — toggle a function to begin.</p>
          )}
        </div>
      </Card>

      <button onClick={onLogout} className="zev-btn-ghost flex w-full items-center justify-center gap-2">
        <LogOut size={16} /> Sign out
      </button>

      {showLicense && (
        <LicenseModal license={status.license} device={status.device} onClose={() => setShowLicense(false)} />
      )}
    </div>
  );
}
