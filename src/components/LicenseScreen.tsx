"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, ShieldCheck, CircleAlert, Clock3 } from "lucide-react";
import { api } from "@/lib/api";
import { getDeviceId, getPlatform } from "@/lib/device";
import { BrandMark } from "./BrandMark";
import type { LicenseStatusResponse } from "@/lib/types";

type Phase = "input" | "checking" | "expired" | "error" | "success";

export function LicenseScreen({ onActivated }: { onActivated: (s: LicenseStatusResponse) => void }) {
  const [key, setKey] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [message, setMessage] = useState("");
  const [expiry, setExpiry] = useState<string | null>(null);

  async function handleActivate() {
    const normalized = key.trim().toUpperCase();
    if (!/^ZEV-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
      setPhase("error");
      setMessage("That key doesn't look right. Format: ZEV-XXXX-XXXX-XXXX.");
      return;
    }
    setPhase("checking");
    setMessage("");
    try {
      const deviceId = getDeviceId();
      const platform = getPlatform();
      const { token } = await api.activateLicense(normalized, deviceId, platform);
      api.saveToken(token);
      setPhase("success");
      // Brief success beat, then enter the app.
      setTimeout(async () => {
        try {
          const status = await api.licenseStatus();
          onActivated(status);
        } catch {
          setPhase("error");
          setMessage("Activated, but loading your session failed. Reopen the app.");
        }
      }, 900);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Activation failed";
      if (/expired/i.test(msg)) {
        setPhase("expired");
        setExpiry(null);
      } else {
        setPhase("error");
        setMessage(msg);
      }
    }
  }

  return (
    <div className="zev-top-pad flex min-h-dvh flex-col px-5 pb-10">
      {/* Branding */}
      <div className="mt-10 flex flex-col items-center text-center">
        <BrandMark size={76} />
        <h1 className="mt-5 text-[34px] font-black tracking-[0.28em]">ZEV</h1>
        <p className="mt-1 text-sm font-semibold tracking-[0.3em] text-cyan-300/90">LOCK</p>
        <p className="mt-4 max-w-[280px] text-[13px] leading-relaxed text-slate-400">
          Enter your key to get started.
        </p>
      </div>

      {/* Key entry */}
      <div className="zev-card mt-8 p-5">
        <label className="text-[11px] font-semibold tracking-[0.18em] text-slate-400">LICENSE KEY</label>
        <div className="relative mt-2">
          <KeyRound size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 shrink-0 text-purple-300/70" />
          <input
            className="zev-input pl-12 font-mono uppercase placeholder:text-slate-600 placeholder:tracking-[0.08em]"
            placeholder="ZEV-XXXX-XXXX-XXXX"
            value={key}
            maxLength={18}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => { setKey(e.target.value.toUpperCase()); if (phase === "error") setPhase("input"); }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleActivate(); }}
          />
        </div>

        {phase === "error" && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <CircleAlert size={17} className="mt-0.5 shrink-0 text-red-400" />
            <p className="text-[13px] text-red-200">{message}</p>
          </motion.div>
        )}

        {phase === "expired" && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-center gap-2">
              <Clock3 size={17} className="text-amber-300" />
              <p className="text-[13px] font-bold text-amber-200">This license has expired{expiry ? ` (${expiry})` : ""}.</p>
            </div>
            <p className="mt-1 text-[13px] text-amber-100/80">Enter another license key to continue.</p>
            <button className="zev-btn-ghost mt-3 w-full" onClick={() => { setKey(""); setPhase("input"); }}>
              Use a different key
            </button>
          </motion.div>
        )}

        {phase === "success" ? (
          <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <ShieldCheck size={20} className="text-emerald-300" />
            <p className="text-sm font-bold text-emerald-200">Activated — creating secure session…</p>
          </motion.div>
        ) : (
          <button className="zev-btn-primary mt-4" disabled={phase === "checking" || key.trim().length < 8} onClick={() => void handleActivate()}>
            {phase === "checking" ? "Verifying…" : "Verify & Activate"}
          </button>
        )}

        <p className="mt-3 text-center text-[11px] text-slate-500">
          Demo key (dev only): <span className="font-mono text-slate-400">ZEV-DEMO-2026-VIP1</span>
        </p>
      </div>

      <div className="mt-auto pt-8" />
    </div>
  );
}
