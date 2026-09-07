"use client";

import { Crown, LogOut, Smartphone } from "lucide-react";
import { Card, ErrorState, Label, Skeleton, StatusDot } from "./ui";
import { fmtDate } from "@/lib/format";
import type { ActivityEvent, FunctionStates, LicenseStatusResponse } from "@/lib/types";
import { FUNCTIONS } from "@/lib/types";

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
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (error || !status) return <ErrorState message={error ?? "Couldn't load your dashboard."} onRetry={onRetry} />;

  const onCount = Object.values(status.functions).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Branding + welcome */}
      <div className="pt-1">
        <h1 className="text-[26px] font-black tracking-[0.2em]">ZEV</h1>
        <p className="mt-0.5 text-[13px] text-slate-400">Welcome back</p>
      </div>

      {/* License status */}
      <Card>
        <Label>LICENSE</Label>
        <div className="mt-1.5 flex items-center gap-2">
          <StatusDot on={status.license.status === "ACTIVE"} />
          <span className="text-lg font-extrabold tracking-wide">{status.license.status}</span>
        </div>
        <p className="mt-1 font-mono text-xs text-slate-400">{status.license.key}</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="flex items-center gap-1.5">
            <Crown size={14} className="text-violet-300" />
            <Label>PLAN</Label>
          </div>
          <p className="mt-1.5 text-[15px] font-extrabold leading-tight">{status.license.plan}</p>
        </Card>
        <Card>
          <Label>EXPIRES</Label>
          <p className="mt-1.5 text-[15px] font-extrabold leading-tight">{fmtDate(status.license.expires_at)}</p>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-1.5">
          <Smartphone size={14} className="text-cyan-300" />
          <Label>DEVICE</Label>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-[15px] font-extrabold">{status.device.platform}</p>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
            <StatusDot on /> {status.device.status}
          </span>
        </div>
      </Card>

      {/* Quick status */}
      <Card>
        <Label>QUICK STATUS</Label>
        <div className="mt-2 space-y-2">
          {FUNCTIONS.map((f) => (
            <div key={f.key} className="flex items-center justify-between text-[13px]">
              <span className="text-slate-300">{f.name}</span>
              <span className="flex items-center gap-1.5 font-bold">
                <StatusDot on={status.functions[f.key as keyof FunctionStates]} />
                <span className={status.functions[f.key as keyof FunctionStates] ? "text-emerald-300" : "text-slate-500"}>
                  {status.functions[f.key as keyof FunctionStates] ? "ON" : "OFF"}
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-white/5 pt-2 text-[11px] text-slate-500">{onCount} of 7 active</p>
      </Card>

      {/* Recent activity */}
      <Card>
        <Label>RECENT ACTIVITY</Label>
        <div className="mt-2 space-y-2.5">
          {activity.slice(0, 5).map((a) => (
            <div key={a.id} className="flex items-center justify-between text-[13px]">
              <span className="text-slate-300">{a.label}</span>
              <span className="font-mono text-[11px] text-slate-500">{a.at}</span>
            </div>
          ))}
          {activity.length === 0 && <p className="text-[13px] text-slate-500">No activity yet — toggle a function to begin.</p>}
        </div>
      </Card>

      <button onClick={onLogout} className="zev-btn-ghost flex w-full items-center justify-center gap-2">
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}
