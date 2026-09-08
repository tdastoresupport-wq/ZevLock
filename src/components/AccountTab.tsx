"use client";

import { useEffect, useState } from "react";
import { Copy, LogOut, Smartphone, Volume2, VolumeX } from "lucide-react";
import { ErrorState, SectionHeader, Skeleton } from "./ui";
import { ConfirmDialog } from "./ui";
import { KeyAvatar } from "./KeyAvatar";
import { ProfilesSection } from "./ProfilesSection";
import { fmtDate } from "@/lib/format";
import { getBatteryInfo, getTelemetry, subscribeOnline, type BatteryInfo, type DeviceTelemetry } from "@/lib/telemetry";
import { isSoundEnabled, playClick, setSoundEnabled } from "@/lib/sound";
import type { LicenseStatusResponse } from "@/lib/types";

/** Account center: profile, license, device facts, session, preferences, actions. */
export function AccountTab({
  status, loading, error, onRetry, onLogout, onResetDevice,
}: {
  status: LicenseStatusResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onLogout: () => void;
  onResetDevice: () => Promise<void>;
}) {
  const [sound, setSound] = useState(isSoundEnabled);
  const [confirmReset, setConfirmReset] = useState(false);
  const [telemetry, setTelemetry] = useState<DeviceTelemetry | null>(null);
  const [battery, setBattery] = useState<BatteryInfo | null>(null);

  useEffect(() => {
    setTelemetry(getTelemetry());
    const unsub = subscribeOnline((online) => {
      setTelemetry((t) => (t ? { ...t, online } : t));
    });
    void getBatteryInfo().then(setBattery);
    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (error || !status) return <ErrorState message={error ?? "Couldn't load your account."} onRetry={onRetry} />;

  const lic = status.license;
  const displayName = lic.display_name || "ZEV Member";

  function flipSound() {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) playClick();
  }

  async function copyKey() {
    playClick();
    try { await navigator.clipboard.writeText(lic.key); } catch { /* ignore */ }
  }

  const facts: [string, string][] = [
    ["Platform", status.device.platform],
    ["Binding", status.device.status === "BOUND" ? "Bound to this device" : "Not bound"],
    ["CPU cores", telemetry?.cores != null ? String(telemetry.cores) : "Unavailable"],
    ["Memory", telemetry?.memoryGB != null ? `~${telemetry.memoryGB} GB` : "Unavailable"],
    ["Screen", telemetry?.screen ?? "Unavailable"],
    ["Network", telemetry?.network ?? (telemetry?.online ? "Online" : "Offline")],
    ["Battery", battery ? `${Math.round(battery.level * 100)}%${battery.charging ? " · charging" : ""}` : "Unavailable"],
  ];

  return (
    <div className="space-y-5">
      <div className="pt-1">
        <h1 className="text-[22px] font-black">Account</h1>
      </div>

      {/* Profile */}
      <div className="flex items-center gap-3.5">
        <KeyAvatar value={lic.avatar} name={displayName} size={60} />
        <div className="min-w-0">
          <p className="truncate text-[18px] font-black">{displayName}</p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">ID ····{lic.key.slice(-4)}</p>
          <span className="zev-badge-premium mt-1.5 !px-3 !py-1 !text-[11px]">♛ {lic.plan}</span>
        </div>
      </div>

      {/* License */}
      <div>
        <SectionHeader kicker="LICENSE" />
        <div className="mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
            <p className="min-w-0 flex-1 truncate font-mono text-[13px] font-bold">{lic.key}</p>
            <button onClick={() => void copyKey()} aria-label="Copy license key" className="rounded-lg border border-white/10 p-2 text-slate-300">
              <Copy size={14} />
            </button>
          </div>
          <InfoRow k="State" v={lic.status} accent />
          <InfoRow k="Created" v={fmtDate(lic.created_at)} />
          <InfoRow k="Expires" v={lic.expires_at ? fmtDate(lic.expires_at) : "Never"} />
        </div>
      </div>

      {/* Device — measured facts only */}
      <div>
        <SectionHeader kicker="THIS DEVICE" />
        <div className="mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          {facts.map(([k, v]) => (
            <InfoRow key={k} k={k} v={v} />
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-600">Measured in this browser — unavailable means the browser hides it.</p>
      </div>

      {/* Session */}
      <div>
        <SectionHeader kicker="SESSION" />
        <div className="mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <InfoRow k="State" v="Active" accent />
          <InfoRow k="Valid until" v={fmtDate(status.session_expires_at)} />
        </div>
      </div>

      {/* iOS install profile */}
      <ProfilesSection />

      {/* Preferences */}
      <div>
        <SectionHeader kicker="PREFERENCES" />        <button
          role="switch"
          aria-checked={sound}
          aria-label="Sound effects"
          onClick={flipSound}
          className="mt-1.5 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-3.5 py-3"
        >
          <span className="flex items-center gap-2.5 text-[13.5px] font-bold">
            {sound ? <Volume2 size={17} className="text-purple-300" /> : <VolumeX size={17} className="text-slate-500" />}
            Sound effects
          </span>
          <span className={`text-[12px] font-black ${sound ? "text-emerald-300" : "text-slate-500"}`}>
            {sound ? "ON" : "OFF"}
          </span>
        </button>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => setConfirmReset(true)}
          className="zev-btn-ghost flex w-full items-center justify-center gap-2"
        >
          <Smartphone size={16} /> Unbind this device
        </button>
        <button onClick={onLogout} className="zev-btn-ghost flex w-full items-center justify-center gap-2" aria-label="Sign out">
          <LogOut size={16} /> Sign out
        </button>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Unbind this device?"
          body="This license will be unbound and you'll sign out. Activate again to continue."
          confirmLabel="Unbind"
          danger
          onConfirm={() => { setConfirmReset(false); return onResetDevice(); }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}

function InfoRow({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/5 px-3.5 py-2 text-[13px] first:border-t-0">
      <span className="shrink-0 text-slate-400">{k}</span>
      <span className={`min-w-0 truncate font-bold ${accent ? "text-emerald-300" : "text-slate-100"}`}>{v}</span>
    </div>
  );
}
