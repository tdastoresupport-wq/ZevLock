"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Download, FileCheck, Info } from "lucide-react";
import { profiles, type GeneratedProfile, type ProfileHistoryItem } from "@/lib/api";
import { validateMobileconfig } from "@/lib/mobileconfig";
import { playClick } from "@/lib/sound";
import { BrandMark } from "./BrandMark";
import { KeyAvatar } from "./KeyAvatar";
import { ErrorState, SectionHeader, Skeleton } from "./ui";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/cn";

const PRESET_META = [
  { id: "legacy", label: "Legacy", hint: "30-day install" },
  { id: "standard", label: "Standard", hint: "1-year install" },
  { id: "high-hz", label: "High-Hz", hint: "7-day install" },
];

/**
 * iOS install profile: generate → validate → download → Settings install.
 * The PWA cannot install a profile silently — iOS always requires the user
 * to approve it in Settings. Copy below says exactly that.
 */
export function ProfilesSection() {
  const [preset, setPreset] = useState("standard");
  const [phase, setPhase] = useState<"idle" | "working" | "ready" | "error">("idle");
  const [payload, setPayload] = useState<GeneratedProfile | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [history, setHistory] = useState<ProfileHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

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

  async function generate() {
    setPhase("working");
    setError("");
    setProblems([]);
    try {
      const res = await profiles.generate(preset);
      const check = validateMobileconfig(res.xml, preset as "legacy" | "standard" | "high-hz");
      if (!check.ok) {
        setProblems(check.errors);
        setPhase("error");
        return;
      }
      setPayload(res);
      setHistory(res.history);
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setPhase("error");
    }
  }

  function download() {
    if (!payload) return;
    playClick();
    setDownloading(true);
    try {
      const blob = new Blob([payload.xml], { type: payload.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      setTimeout(() => setDownloading(false), 600);
    }
  }

  return (
    <div>
      <SectionHeader kicker="IOS INSTALL PROFILE" />
      <div className="mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-3 px-3.5 pt-3.5">
          <BrandMark size={34} />
          <p className="text-[13px] leading-snug text-slate-300">
            Adds a Zev Lock shortcut to your Home Screen. No system changes, no gameplay effects.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5 px-3.5 pt-3">
          {PRESET_META.map((p) => (
            <button
              key={p.id}
              onClick={() => { playClick(); setPreset(p.id); setPhase("idle"); setPayload(null); }}
              aria-pressed={preset === p.id}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-center",
                preset === p.id ? "border-purple-300/60 bg-purple-500/20" : "border-white/10"
              )}
            >
              <span className={cn("block text-[13px] font-black", preset === p.id ? "text-white" : "text-slate-300")}>{p.label}</span>
              <span className="block text-[10.5px] text-slate-500">{p.hint}</span>
            </button>
          ))}
        </div>

        <div className="px-3.5 py-3">
          {phase !== "ready" ? (
            <button className="zev-btn-primary" disabled={phase === "working"} onClick={() => void generate()}>
              {phase === "working" ? "Building…" : "Generate profile"}
            </button>
          ) : (
            payload && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
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
                  onClick={download}
                  disabled={downloading}
                  className="zev-btn-primary mt-2.5 flex items-center justify-center gap-2"
                >
                  <Download size={17} /> {downloading ? "Preparing…" : "Download profile"}
                </motion.button>
                <button
                  onClick={() => { setPhase("idle"); setPayload(null); }}
                  className="mt-2 w-full text-center text-[12px] font-bold text-slate-400"
                >
                  Build a different one
                </button>
              </motion.div>
            )
          )}
          {phase === "error" && (
            <div className="mt-2">
              <ErrorState
                message={error || "This profile did not pass validation and was not offered for download."}
                onRetry={() => void generate()}
              />
              {problems.length > 0 && (
                <ul className="mt-2 space-y-1 font-mono text-[11px] text-red-300">
                  {problems.map((p) => <li key={p}>· {p}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-white/5 px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-black tracking-[0.18em] text-slate-400">
            <Info size={12} /> INSTALL ON IPHONE
          </p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-slate-300">
            <li>Tap Download above (Safari keeps the file).</li>
            <li>Open <b>Settings</b> — tap <b>Profile Downloaded</b> at the top, or go to General → VPN &amp; Device Management.</li>
            <li>Tap <b>Install</b> and confirm. The shortcut appears on your Home Screen.</li>
          </ol>
          <p className="mt-1.5 text-[11.5px] text-slate-500">
            iOS always asks you to approve profiles in Settings. Nothing installs silently.
          </p>
        </div>

        <div className="border-t border-white/5 px-3.5 py-3">
          <p className="text-[11px] font-black tracking-[0.18em] text-slate-400">PROFILE HISTORY</p>
          {historyLoading ? (
            <Skeleton className="mt-2 h-10 w-full" />
          ) : history.length === 0 ? (
            <p className="mt-1.5 text-[12.5px] text-slate-500">No profiles built yet on this license.</p>
          ) : (
            <div className="mt-1.5 space-y-1.5">
              {history.slice(0, 8).map((h) => (
                <div key={h.uuid} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="flex min-w-0 items-center gap-1.5 text-slate-200">
                    <BadgeCheck size={13} className="shrink-0 text-emerald-300" />
                    <span className="truncate font-bold capitalize">{h.preset}</span>
                  </span>
                  <span className="tnum shrink-0 font-mono text-[10.5px] text-slate-500">{fmtDate(h.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
