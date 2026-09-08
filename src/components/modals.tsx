"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, Copy, ShieldCheck, Smartphone, X } from "lucide-react";
import { HeroArt } from "./HeroArt";
import { fmtDate } from "@/lib/format";
import { playClick } from "@/lib/sound";

/**
 * Cinematic welcome (~950ms staged reveal):
 * logo fade → purple light sweep → status reveal → CTA reveal.
 * Shown on every login (after activation / on session boot).
 */
export function WelcomeModal({
  plan, device, onEnter,
}: {
  plan: string;
  device: string;
  onEnter: () => void;
}) {
  const reduce = useReducedMotion();
  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5"
    >
      <motion.div
        initial={{ scale: 0.94, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 8, opacity: 0 }}
        transition={{ duration: 0.22, ease }}
        className="zev-card w-full max-w-[400px] overflow-hidden p-0"
      >
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease }}
          >
            <HeroArt className="!rounded-none !border-0 min-h-[190px]">
              <p className="text-[11px] font-bold tracking-[0.24em] text-purple-200">ZEV LOCK</p>
              <h2 className="text-xl font-black">Welcome back</h2>
            </HeroArt>
          </motion.div>
          {!reduce && (
            <motion.span
              aria-hidden="true"
              className="zev-sweep"
              initial={{ x: "-160%" }}
              animate={{ x: "480%" }}
              transition={{ delay: 0.25, duration: 0.32, ease: "easeInOut" }}
            />
          )}
        </div>
        <div className="space-y-3 p-5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0 : 0.1, duration: 0.2 }}
            className="flex justify-center"
          >
            <span className="zev-badge-premium">♛ {plan}</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.55, duration: 0.25, ease }}
            className="space-y-1.5 text-center text-[13px] text-slate-300"
          >
            <p className="flex items-center justify-center gap-1.5">
              <Smartphone size={14} className="text-purple-300" /> {device} · Bound
            </p>
            <p className="flex items-center justify-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-300" /> Session ready
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.8, duration: 0.25, ease }}
          >
            <button className="zev-btn-primary" onClick={() => { playClick(); onEnter(); }}>
              Enter dashboard
            </button>
          </motion.div>
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
          <BadgeCheck size={12} /> Verified by Zev Lock
        </p>
      </div>
    </div>
  );
}
