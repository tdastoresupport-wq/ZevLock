"use client";

import { useEffect, useState } from "react";
import { Copy, LogOut, Smartphone, Volume2, VolumeX } from "lucide-react";
import { ErrorState, SectionHeader, Skeleton } from "./ui";
import { ConfirmDialog } from "./ui";
import { KeyAvatar } from "./KeyAvatar";
import { fmtDate } from "@/lib/format";
import { getBatteryInfo, getTelemetry, subscribeOnline, type BatteryInfo, type DeviceTelemetry } from "@/lib/telemetry";
import { isSoundEnabled, playClick, setSoundEnabled } from "@/lib/sound";
import { useLicenseCountdown } from "@/lib/useLicenseCountdown";
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
  // Server-anchored countdown: continuous across reload, immune to clock tampering.
  const countdown = useLicenseCountdown(
    status ? { expiresAt: status.license.expires_at, serverNow: status.license.server_now, isPermanent: status.license.is_permanent === 1 } : { expiresAt: null, serverNow: null, isPermanent: false }
  );

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
  if (error || !status) return <ErrorState message={error ?? "Không tải được tài khoản."} onRetry={onRetry} />;

  const lic = status.license;
  const displayName = lic.display_name || "Thành viên ZEV";

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
    ["Nền tảng", status.device.platform],
    ["Liên kết", status.device.status === "BOUND" ? "Đã gắn với máy này" : "Chưa gắn"],
    ["Nhân CPU", telemetry?.cores != null ? String(telemetry.cores) : "Không có"],
    ["Bộ nhớ", telemetry?.memoryGB != null ? `~${telemetry.memoryGB} GB` : "Không có"],
    ["Màn hình", telemetry?.screen ?? "Không có"],
    ["Mạng", telemetry?.network ?? (telemetry?.online ? "Trực tuyến" : "Ngoại tuyến")],
    ["Pin", battery ? `${Math.round(battery.level * 100)}%${battery.charging ? " · đang sạc" : ""}` : "Không có"],
  ];

  return (
    <div className="space-y-5">
      <div className="pt-1">
        <h1 className="text-[22px] font-black">Tài khoản</h1>
      </div>

      {/* Profile */}
      <div className="zev-enter flex items-center gap-3.5">
        <KeyAvatar value={lic.avatar} name={displayName} size={60} />
        <div className="min-w-0">
          <p className="truncate text-[18px] font-black">{displayName}</p>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">ID ····{lic.key.slice(-4)}</p>
          <span className="zev-badge-premium mt-1.5 !px-3 !py-1 !text-[11px]">♛ {lic.plan}</span>
        </div>
      </div>

      {/* License */}
      <div>
        <SectionHeader kicker="BẢN QUYỀN" />
        <div className="mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
            <p className="min-w-0 flex-1 truncate font-mono text-[13px] font-bold">{lic.key}</p>
            <button onClick={() => void copyKey()} aria-label="Chép mã key" className="rounded-lg border border-white/10 p-2 text-slate-300" style={{ minWidth: 44, minHeight: 44 }}>
              <Copy size={14} />
            </button>
          </div>
          <InfoRow k="Trạng thái" v={lic.status} accent />
          <InfoRow k="Còn lại" v={countdown.label} accent />
          <InfoRow k="Ngày tạo" v={fmtDate(lic.created_at)} />
          <InfoRow k="Hết hạn" v={lic.is_permanent === 1 ? "Vĩnh viễn" : fmtDate(lic.expires_at)} />
        </div>
      </div>

      {/* Active function state (server-authoritative) */}
      <div>
        <SectionHeader kicker="CHỨC NĂNG" />
        <div className="mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <InfoRow k="Đang bật" v={`${Object.values(status.functions).filter(Boolean).length}/${Object.keys(status.functions).length} chức năng`} accent />
        </div>
      </div>

      {/* Device — measured facts only */}
      <div>
        <SectionHeader kicker="MÁY NÀY" />
        <div className="mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          {facts.map(([k, v]) => (
            <InfoRow key={k} k={k} v={v} />
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-600">Số liệu đo trong trình duyệt — chữ “Không có” nghĩa là trình duyệt không cho xem.</p>
      </div>

      {/* Session */}
      <div>
        <SectionHeader kicker="PHIÊN" />
        <div className="mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <InfoRow k="Trạng thái" v="Đang dùng" accent />
          <InfoRow k="Hiệu lực đến" v={fmtDate(status.session_expires_at)} />
        </div>
      </div>

      {/* Preferences */}
      <div>
        <SectionHeader kicker="TÙY CHỌN" />        <button
          role="switch"
          aria-checked={sound}
          aria-label="Âm thanh"
          onClick={flipSound}
          className="mt-1.5 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-3.5 py-3"
        >
          <span className="flex items-center gap-2.5 text-[13.5px] font-bold">
            {sound ? <Volume2 size={17} className="text-purple-300" /> : <VolumeX size={17} className="text-slate-500" />}
            Âm thanh
          </span>
          <span className={`text-[12px] font-black ${sound ? "text-emerald-300" : "text-slate-500"}`}>
            {sound ? "BẬT" : "TẮT"}
          </span>
        </button>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => setConfirmReset(true)}
          className="zev-btn-ghost flex w-full items-center justify-center gap-2"
        >
          <Smartphone size={16} /> Gỡ máy này
        </button>
        <button onClick={onLogout} className="zev-btn-ghost flex w-full items-center justify-center gap-2" aria-label="Đăng xuất">
          <LogOut size={16} /> Đăng xuất
        </button>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Gỡ máy này?"
          body="Key sẽ được gỡ khỏi máy và bạn sẽ đăng xuất. Kích hoạt lại để dùng tiếp."
          confirmLabel="Gỡ máy"
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
