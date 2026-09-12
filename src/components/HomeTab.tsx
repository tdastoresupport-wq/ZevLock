"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, LogOut, Power, RefreshCw, SlidersHorizontal, Volume2, VolumeX } from "lucide-react";
import { ErrorState, SectionHeader, Skeleton, StatusDot } from "./ui";
import { Avatar, HeroArt } from "./HeroArt";
import { HealthRing } from "./HealthRing";
import { LicenseModal } from "./modals";
import { fmtDate, greeting, timeAgo } from "@/lib/format";
import { isSoundEnabled, playClick, setSoundEnabled } from "@/lib/sound";
import { useLicenseCountdown } from "@/lib/useLicenseCountdown";
import { DUR, PRESS } from "@/lib/motion";
import type { ActivityEvent, FunctionKey, FunctionStates, LicenseStatusResponse } from "@/lib/types";
import { FUNCTIONS } from "@/lib/types";
import { cn } from "@/lib/cn";

export function HomeTab({
  status, loading, error, activity, pendingKeys, onRetry, onLogout, onOpenControls, onToggle,
}: {
  status: LicenseStatusResponse | null;
  loading: boolean;
  error: string | null;
  activity: ActivityEvent[];
  pendingKeys: ReadonlySet<FunctionKey>;
  onRetry: () => void;
  onLogout: () => void;
  onOpenControls: () => void;
  onToggle: (key: FunctionKey, next: boolean) => Promise<void>;
}) {
  const [showLicense, setShowLicense] = useState(false);
  const [sound, setSound] = useState(isSoundEnabled);
  const [failed, setFailed] = useState<FunctionKey | null>(null);
  // Server-anchored license countdown (survives reload, ignores device clock).
  const countdown = useLicenseCountdown(
    status ? { expiresAt: status.license.expires_at, serverNow: status.license.server_now, isPermanent: status.license.is_permanent === 1 } : { expiresAt: null, serverNow: null, isPermanent: false }
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full !rounded-[22px]" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }
  if (error || !status) return <ErrorState message={error ?? "Không tải được bảng điều khiển."} onRetry={onRetry} />;

  const onCount = Object.values(status.functions).filter(Boolean).length;
  const active = FUNCTIONS.filter((f) => status.functions[f.key]);
  const standby = FUNCTIONS.filter((f) => !status.functions[f.key]);

  function flipSound() {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) playClick();
  }

  async function flip(key: FunctionKey) {
    if (pendingKeys.has(key) || !status) return;
    setFailed(null);
    try {
      await onToggle(key, !status.functions[key]);
    } catch {
      setFailed(key);
    }
  }

  const actions = [
    { id: "controls", label: "Điều khiển", icon: SlidersHorizontal, fn: () => { playClick(); onOpenControls(); } },
    { id: "license", label: "Bản quyền", icon: KeyRound, fn: () => { playClick(); setShowLicense(true); } },
    { id: "sound", label: sound ? "Đang bật loa" : "Tắt loa", icon: sound ? Volume2 : VolumeX, fn: flipSound },
    { id: "sync", label: "Đồng bộ", icon: RefreshCw, fn: () => { playClick(); onRetry(); } },
  ];

  return (
    <div className="space-y-5">
      {/* Hero: artwork + identity + plan */}
      <HeroArt className="min-h-[172px]">
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar size={46} />
            <div className="min-w-0">
              <h1 className="text-[20px] font-black leading-none tracking-[0.14em]">ZEV</h1>
              <p className="mt-1 truncate text-[12.5px] text-slate-200">
                {greeting()} · Sẵn sàng
              </p>
            </div>
          </div>
          <span className="zev-badge-premium shrink-0 !px-3 !py-1.5 !text-[11px]">♛ {status.license.plan}</span>
        </div>
      </HeroArt>

      {/* Focal: system health ring */}
      <div aria-live="polite">
        <HealthRing active={onCount} total={FUNCTIONS.length} />
      </div>

      {/* Compact status strip — no oversized cards */}
      <div>
        <button className="zev-strip w-full text-left" onClick={() => setShowLicense(true)} aria-label="Xem chi tiết bản quyền">
          <span className="text-slate-400">Bản quyền</span>
          <span className="flex items-center gap-1.5 font-bold">
            <span className="dot dot-on-green" />
            <span className="text-emerald-300">{status.license.status}</span>
            <span className="font-mono text-[11px] font-medium text-slate-500">{status.license.key.slice(-4)}</span>
          </span>
        </button>
        <div className="zev-strip">
          <span className="text-slate-400">Thiết bị</span>
          <span className="font-bold">{status.device.platform} · <span className="text-emerald-300">{status.device.status}</span></span>
        </div>
        <div className="zev-strip">
          <span className="text-slate-400">Hết hạn</span>
          <span className="tnum font-bold">
            {status.license.is_permanent === 1 ? "Vĩnh viễn" : `${countdown.label} · ${fmtDate(status.license.expires_at)}`}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <motion.button
              key={a.id}
              whileTap={{ scale: PRESS.std }}
              onClick={a.fn}
              className="zev-noselect flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] py-3 text-slate-200"
              aria-label={a.label}
            >
              <Icon size={19} className="text-purple-300" />
              <span className="text-[10.5px] font-bold">{a.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Grouped systems: active first, dense tappable rows */}
      <div className="space-y-4">
        <SystemGroup
          title={`ĐANG BẬT · ${active.length}`}
          keys={active.map((f) => f.key)}
          functions={status.functions}
          pendingKeys={pendingKeys}
          failed={failed}
          onFlip={(k) => void flip(k)}
        />
        {standby.length > 0 && (
          <SystemGroup
            title={`ĐANG TẮT · ${standby.length}`}
            dim
            keys={standby.map((f) => f.key)}
            functions={status.functions}
            pendingKeys={pendingKeys}
            failed={failed}
            onFlip={(k) => void flip(k)}
          />
        )}
      </div>

      {/* Recent activity — real events only */}
      <div>
        <SectionHeader kicker="HOẠT ĐỘNG GẦN ĐÂY" />
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
                  {a.action ?? (a.kind === "enabled" ? "Đã bật" : "Đã tắt")}
                  {a.iso ? ` · ${timeAgo(a.iso)}` : a.at ? ` · ${a.at}` : ""}
                </p>
              </div>
            </div>
          ))}
          {activity.length === 0 && (
            <p className="text-[13px] text-slate-500">Chưa có gì — bật một chức năng để bắt đầu.</p>
          )}
        </div>
      </div>

      <button onClick={onLogout} className="zev-btn-ghost flex w-full items-center justify-center gap-2" aria-label="Đăng xuất">
        <LogOut size={16} /> Đăng xuất
      </button>

      {showLicense && (
        <LicenseModal license={status.license} device={status.device} onClose={() => setShowLicense(false)} />
      )}
    </div>
  );
}

function SystemGroup({
  title, keys, functions, pendingKeys, failed, onFlip, dim,
}: {
  title: string;
  keys: FunctionKey[];
  functions: FunctionStates;
  pendingKeys: ReadonlySet<FunctionKey>;
  failed: FunctionKey | null;
  onFlip: (k: FunctionKey) => void;
  dim?: boolean;
}) {
  if (keys.length === 0) return null;
  return (
    <div>
      <SectionHeader kicker={title} />
      <div className={cn("mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]", dim && "opacity-75")}>
        {/* Exit-only fade on group change. No enter/layout animation. */}
        <AnimatePresence initial={false} mode="popLayout">
        {keys.map((key, i) => {
          const meta = FUNCTIONS.find((f) => f.key === key)!;
          const on = functions[key];
          const busy = pendingKeys.has(key);
          return (
            <motion.button
              key={key}
              role="switch"
              aria-checked={on}
              aria-label={`${meta.name}, ${on ? "on" : "off"}`}
              whileTap={{ scale: PRESS.soft }}
              exit={{ opacity: 0, transition: { duration: DUR.press } }}
              onClick={() => onFlip(key)}
              className={cn(
                "zev-noselect flex w-full items-center gap-3 px-3.5 py-2.5 text-left",
                i > 0 && "border-t border-white/5"
              )}
            >
              <span className={cn("h-8 w-[3px] shrink-0 rounded-full", on ? "bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" : "bg-slate-700")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-bold">{meta.name}</span>
                <span className="block truncate text-[11.5px] text-slate-400">{meta.blurb}</span>
                {failed === key && <span className="block text-[11px] text-red-400">Lưu lỗi — đã hoàn tác.</span>}
              </span>
              <span className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tracking-wider",
                on ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-slate-500"
              )}>
                {busy ? "…" : on ? "ON" : "OFF"}
              </span>
              <StatusDot on={on} />
            </motion.button>
          );
        })}
        </AnimatePresence>
      </div>
    </div>
  );
}

