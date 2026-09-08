"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Download, FileCheck, Info } from "lucide-react";
import { profiles, type GeneratedProfile, type ProfileHistoryItem } from "@/lib/api";
import {
  PRESET_MARKETING,
  UNSUPPORTED_TOUCH_SETTINGS,
  validateMobileconfig,
} from "@/lib/mobileconfig";
import { playClick, playError } from "@/lib/sound";
import { BrandMark } from "./BrandMark";
import { KeyAvatar } from "./KeyAvatar";
import { ErrorState, SectionHeader, Skeleton } from "./ui";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/cn";

type Phase =
  | "READY"
  | "GENERATING"
  | "VALIDATING"
  | "READY_TO_DOWNLOAD"
  | "DOWNLOADING"
  | "AWAITING_IOS_INSTALL"
  | "ERROR";

const PHASE_LABEL: Record<Phase, string> = {
  READY: "Ready",
  GENERATING: "Building profile…",
  VALIDATING: "Validating…",
  READY_TO_DOWNLOAD: "Validated",
  DOWNLOADING: "Preparing file…",
  AWAITING_IOS_INSTALL: "Waiting for iOS install",
  ERROR: "Something went wrong",
};

/**
 * iOS install profile flow:
 * READY → GENERATING → VALIDATING → READY_TO_DOWNLOAD → DOWNLOADING →
 * AWAITING_IOS_INSTALL. "Installed" is never shown — the web cannot verify
 * an iOS profile installation, and the PWA cannot install one silently.
 */
export function ProfilesSection() {
  const [preset, setPreset] = useState("standard");
  const [phase, setPhase] = useState<Phase>("READY");
  const [payload, setPayload] = useState<GeneratedProfile | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [history, setHistory] = useState<ProfileHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");

  const marketing = PRESET_MARKETING[preset as keyof typeof PRESET_MARKETING] ?? PRESET_MARKETING.standard;

  async function loadHistory() {
    try {
      const res = await profiles.history();
      setHistory(res.items);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => { void loadHistory(); }, []);

  function fail(msg: string, errs: string[] = []) {
    setError(msg);
    setProblems(errs);
    setPhase("ERROR");
    playError();
  }

  async function generate() {
    playClick();
    setPhase("GENERATING");
    setError("");
    setProblems([]);
    try {
      const res = await profiles.generate(preset);
      setPhase("VALIDATING");
      // Independent server-side validation round-trip + local structural check.
      const report = await profiles.validate(preset);
      const local = validateMobileconfig(res.xml, preset as "legacy" | "standard" | "high-hz");
      const errs = [...report.errors, ...local.errors];
      if (!report.ok || !local.ok) {
        fail("This profile did not pass validation and was not offered for download.", errs);
        return;
      }
      setPayload(res);
      setHistory(res.history);
      setPhase("READY_TO_DOWNLOAD");
    } catch (e) {
      fail(e instanceof Error ? e.message : "Generation failed");
    }
  }

  async function download() {
    if (!payload || phase === "DOWNLOADING") return;
    playClick();
    setPhase("DOWNLOADING");
    try {
      const t = localStorage.getItem("zev_token");
      const res = await fetch(profiles.downloadUrl(payload.uuid), {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!res.ok) throw new Error("Download failed — try generating again.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setPhase("AWAITING_IOS_INSTALL");
      void loadHistory();
    } catch (e) {
      fail(e instanceof Error ? e.message : "Download failed");
    }
  }

  async function downloadRow(uuid: string, filename: string) {
    playClick();
    try {
      const t = localStorage.getItem("zev_token");
      const res = await fetch(profiles.downloadUrl(uuid), {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      void loadHistory();
    } catch {
      playError();
    }
  }

  return (
    <div>
      <SectionHeader kicker="IOS INSTALL PROFILE" />
      <div className="mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        {/* Marketing card — PWA typography only; the plist itself stays plain text. */}
        <div className="px-3.5 pt-3.5">
          <p className="text-[11px] font-black tracking-[0.24em] text-purple-200">ZEV LOCK</p>
          <h3 className="mt-0.5 text-[19px] font-black">{marketing.title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{marketing.tagline}</p>
          <dl className="mt-2.5 space-y-1 text-[12.5px]">
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-500">Device Support:</dt>
              <dd className="font-bold text-slate-100">{marketing.deviceSupport}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-500">Price:</dt>
              <dd className="font-bold text-slate-100">{marketing.price}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-500">TikTok:</dt>
              <dd className="font-bold text-slate-100">{marketing.tiktok}</dd>
            </div>
            <p className="pt-0.5 text-[12.5px] font-semibold text-purple-200">Duc Anh Zev Trùm File</p>
          </dl>
          <p className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-2.5 text-[11.5px] leading-relaxed text-amber-100/90">
            Preset names are labels. iOS profiles cannot change display refresh rate or hardware
            capability. {marketing.manualNote}
          </p>
        </div>

        {/* Preset picker */}
        <div className="grid grid-cols-3 gap-1.5 px-3.5 pt-3">
          {(Object.keys(PRESET_MARKETING) as (keyof typeof PRESET_MARKETING)[]).map((id) => (
            <button
              key={id}
              onClick={() => { playClick(); setPreset(id); setPhase("READY"); setPayload(null); }}
              aria-pressed={preset === id}
              className={cn(
                "rounded-xl border px-2 py-2 text-[12.5px] font-black",
                preset === id ? "border-purple-300/60 bg-purple-500/20 text-white" : "border-white/10 text-slate-400"
              )}
            >
              {PRESET_MARKETING[id].title}
            </button>
          ))}
        </div>

        {/* Manual touch settings (unsupported by public profile schema) */}
        <div className="px-3.5 pt-3">
          <p className="text-[11px] font-black tracking-[0.18em] text-slate-400">MANUAL TOUCH SETUP</p>
          <ul className="mt-1.5 space-y-1.5">
            {UNSUPPORTED_TOUCH_SETTINGS.map((s) => (
              <li key={s.name} className="rounded-xl border border-white/[0.07] bg-black/20 p-2.5">
                <p className="text-[12.5px] font-bold text-slate-100">{s.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-purple-200/90">{s.manualPath}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* State machine */}
        <div className="px-3.5 py-3">
          <p role="status" className="tnum text-center text-[11px] font-black tracking-[0.2em] text-slate-400">
            {PHASE_LABEL[phase].toUpperCase()}
          </p>

          {(phase === "READY" || phase === "ERROR") && (
            <button className="zev-btn-primary mt-2" onClick={() => void generate()}>
              Generate profile
            </button>
          )}
          {(phase === "GENERATING" || phase === "VALIDATING") && (
            <div className="mt-2 overflow-hidden rounded-2xl bg-white/[0.04]">
              <motion.div
                className="h-2 bg-gradient-to-r from-violet-600 to-purple-400"
                initial={{ width: phase === "GENERATING" ? "15%" : "55%" }}
                animate={{ width: phase === "GENERATING" ? "55%" : "92%" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
          )}

          {phase === "READY_TO_DOWNLOAD" && payload && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
              <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <KeyAvatar value="zev" name="Z" size={36} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-black text-emerald-200">
                    <FileCheck size={14} /> Validated — ready
                  </p>
                  <p className="truncate font-mono text-[11px] text-emerald-100/70">{payload.filename}</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => void download()}
                className="zev-btn-primary mt-2.5 flex items-center justify-center gap-2"
              >
                <Download size={17} /> Download .mobileconfig
              </motion.button>
              <button onClick={() => { setPhase("READY"); setPayload(null); }} className="mt-2 w-full text-center text-[12px] font-bold text-slate-400">
                Build a different one
              </button>
            </motion.div>
          )}

          {phase === "DOWNLOADING" && (
            <p className="mt-2 text-center text-[13px] text-slate-300">Fetching your file…</p>
          )}

          {phase === "AWAITING_IOS_INSTALL" && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3">
              <p className="text-[13px] font-black text-sky-200">File downloaded — now install it in Settings</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-slate-300">
                <li>Open <b>Settings</b> — tap <b>Profile Downloaded</b> at the top, or go to General → VPN &amp; Device Management.</li>
                <li>Tap <b>Install</b> and confirm. The shortcut appears on your Home Screen.</li>
              </ol>
              <p className="mt-1.5 text-[11.5px] text-slate-500">
                Status stays “Downloaded” here — the web cannot see inside iOS Settings, so it never claims “Installed”.
              </p>
              <button onClick={() => { setPhase("READY"); setPayload(null); }} className="mt-2 w-full text-center text-[12px] font-bold text-slate-400">
                Done
              </button>
            </motion.div>
          )}

          {phase === "ERROR" && (
            <div className="mt-2">
              <ErrorState message={error || "Validation failed."} onRetry={() => void generate()} />
              {problems.length > 0 && (
                <ul className="mt-2 space-y-1 font-mono text-[11px] text-red-300">
                  {problems.map((p) => <li key={p}>· {p}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Install note (always visible) */}
        <div className="border-t border-white/5 px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.18em] text-slate-400">
            <Info size={12} /> INSTALL ON IPHONE
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-300">
            Safari downloads the file. iOS always asks you to approve profiles in Settings — nothing installs silently.
          </p>
        </div>

        {/* History */}
        <div className="border-t border-white/5 px-3.5 py-3">
          <p className="text-[11px] font-black tracking-[0.18em] text-slate-400">PROFILE HISTORY</p>
          {historyLoading ? (
            <Skeleton className="mt-2 h-10 w-full" />
          ) : history.length === 0 ? (
            <p className="mt-1.5 text-[12.5px] text-slate-500">No profiles built yet on this license.</p>
          ) : (
            <div className="mt-1.5 space-y-2">
              {history.slice(0, 8).map((h) => (
                <div key={h.uuid} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-100">
                      <BadgeCheck size={13} className="shrink-0 text-emerald-300" />
                      <span className="truncate capitalize">{h.preset}</span>
                      <span className={cn(
                        "shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-black tracking-wider",
                        h.downloaded ? "bg-sky-500/15 text-sky-300" : "bg-white/5 text-slate-400"
                      )}>
                        {h.downloaded ? "DOWNLOADED" : "READY"}
                      </span>
                    </p>
                    <p className="tnum mt-0.5 font-mono text-[10.5px] text-slate-500">{fmtDate(h.created_at)}</p>
                  </div>
                  <button
                    onClick={() => void downloadRow(h.uuid, `zev-lock-${h.preset}.mobileconfig`)}
                    aria-label={`Download ${h.preset} profile`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-purple-200"
                  >
                    <Download size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <BrandMark size={20} />
            <p className="text-[11px] text-slate-600">Zev Lock install profiles · schema v1</p>
          </div>
        </div>
      </div>
    </div>
  );
}
