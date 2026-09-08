"use client";

import { motion } from "framer-motion";
import { BadgeCheck, Copy, ShieldCheck, Smartphone, X } from "lucide-react";
import { HeroArt } from "./HeroArt";
import { fmtDate } from "@/lib/format";

/** Welcome popup shown on every login (after activation / on session boot). */
export function WelcomeModal({
  plan, device, onEnter,
}: {
  plan: string;
  device: string;
  onEnter: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5"
    >
      <motion.div
        initial={{ scale: 0.94, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="zev-card w-full max-w-[400px] overflow-hidden p-0"
      >
        <HeroArt className="!rounded-none !border-0 min-h-[190px]">
          <p className="text-[11px] font-bold tracking-[0.24em] text-purple-200">ZEV LOCK</p>
          <h2 className="text-xl font-black">Welcome back</h2>
        </HeroArt>
        <div className="space-y-3 p-5">
          <div className="flex justify-center">
            <span className="zev-badge-premium">♛ {plan}</span>
          </div>
          <div className="space-y-1.5 text-center text-[13px] text-slate-300">
            <p className="flex items-center justify-center gap-1.5">
              <Smartphone size={14} className="text-purple-300" /> {device} · Bound
            </p>
            <p className="flex items-center justify-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-300" /> Secure session created
            </p>
          </div>
          <button className="zev-btn-primary" onClick={onEnter}>
            Enter dashboard
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** License detail popup opened from the Home license card. */
export function LicenseModal({
  license, device, onClose,
}: {
  license: { key: string; plan: string; status: string; expires_at: string | null; activated_at: string | null };
  device: { platform: string; status: string };
  onClose: () => void;
}) {
  async function copy() {
    try { await navigator.clipboard.writeText(license.key); } catch { /* ignore */ }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div className="zev-card w-full max-w-[400px] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black">License</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full border border-white/10 p-1.5 text-slate-400">
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="break-all font-mono text-[13px] font-bold">{license.key}</p>
          <button onClick={() => void copy()} aria-label="Copy key" className="zev-btn-ghost shrink-0 !px-2.5 !py-1.5">
            <Copy size={14} />
          </button>
        </div>
        <div className="mt-3 space-y-1.5 text-[13px] text-slate-300">
          <p className="flex items-center justify-between">Plan <span className="zev-badge-premium !px-2.5 !py-1 !text-[11px]">♛ {license.plan}</span></p>
          <p className="flex items-center justify-between">Status <b className="text-emerald-300">{license.status}</b></p>
          <p className="flex items-center justify-between">Expires <b>{fmtDate(license.expires_at)}</b></p>
          <p className="flex items-center justify-between">Activated <b>{fmtDate(license.activated_at)}</b></p>
          <p className="flex items-center justify-between">Device <b>{device.platform} · {device.status}</b></p>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-slate-500">
          <BadgeCheck size={12} /> Protected by Zev Lock
        </p>
      </div>
    </div>
  );
}
