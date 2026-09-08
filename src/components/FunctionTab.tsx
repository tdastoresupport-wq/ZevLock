"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Crosshair, Power } from "lucide-react";
import { SectionHeader, Skeleton, Toggle } from "./ui";
import { api } from "@/lib/api";
import { playError, playOff, playOn } from "@/lib/sound";
import { FUNCTIONS, type ActivityEvent, type FunctionKey, type FunctionStates } from "@/lib/types";
import { fmtTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Function control center — VIRTUAL / SIMULATED toggles only.
 * Toggling persists state to the backend (D1) and never interacts
 * with any game, process, memory, or external system.
 */
export function FunctionTab({
  functions, savingKey, savingAll, onToggle, onToggleAll,
}: {
  functions: FunctionStates | null;
  savingKey: FunctionKey | null;
  savingAll: boolean;
  onToggle: (key: FunctionKey, next: boolean) => Promise<void>;
  onToggleAll: (next: boolean) => Promise<void>;
}) {
  const [failed, setFailed] = useState<FunctionKey | null>(null);
  const [masterFailed, setMasterFailed] = useState(false);

  async function handle(key: FunctionKey) {
    if (!functions || savingKey || savingAll) return;
    setFailed(null);
    try {
      await onToggle(key, !functions[key]);
    } catch {
      setFailed(key);
    }
  }

  async function handleMaster() {
    if (!functions || savingKey || savingAll) return;
    setMasterFailed(false);
    try {
      const allOn = FUNCTIONS.every((f) => functions[f.key]);
      await onToggleAll(!allOn);
    } catch {
      setMasterFailed(true);
    }
  }

  if (!functions) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const onCount = FUNCTIONS.filter((f) => functions[f.key]).length;
  const allOn = onCount === FUNCTIONS.length;
  const active = FUNCTIONS.filter((f) => functions[f.key]);
  const standby = FUNCTIONS.filter((f) => !functions[f.key]);

  return (
    <div className="space-y-5">
      <div className="pt-1">
        <h1 className="text-[22px] font-black">Control Center</h1>
        <p className="mt-0.5 text-[12px] text-slate-400">Tune each preset.</p>
      </div>

      {/* Master control */}
      <div className="overflow-hidden rounded-2xl border border-purple-300/25 bg-gradient-to-b from-violet-600/15 to-transparent">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            allOn ? "border-purple-300/50 bg-purple-500/20 text-purple-100" : "border-white/10 bg-white/5 text-slate-400"
          )}>
            <Power size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-black">All systems</p>
            <p className="tnum text-[11.5px] text-slate-400" aria-live="polite">
              {savingAll ? "Applying…" : `${onCount}/${FUNCTIONS.length} engaged`}
            </p>
            {masterFailed && <p className="text-[11px] text-red-400">Bulk update failed — rolled back.</p>}
          </div>
          <motion.button
            whileTap={{ scale: 0.94 }}
            disabled={savingAll || !!savingKey}
            onClick={() => void handleMaster()}
            className={cn(
              "shrink-0 rounded-full px-4 py-2.5 text-[12px] font-black tracking-wide text-white disabled:opacity-50",
              allOn ? "bg-white/10 text-slate-200" : "bg-gradient-to-r from-violet-600 to-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.4)]"
            )}
            style={{ minHeight: 44 }}
          >
            {savingAll ? "Working…" : allOn ? "Turn all off" : "Turn all on"}
          </motion.button>
        </div>
      </div>

      {/* Grouped by state */}
      <ControlGroup
        title={`ACTIVE · ${active.length}`}
        items={active}
        functions={functions}
        savingKey={savingKey}
        busyAll={savingAll}
        failed={failed}
        onHandle={(k) => void handle(k)}
      />
      <ControlGroup
        title={`INACTIVE · ${standby.length}`}
        items={standby}
        dim
        functions={functions}
        savingKey={savingKey}
        busyAll={savingAll}
        failed={failed}
        onHandle={(k) => void handle(k)}
      />

      <ErrorStateInline />
    </div>
  );
}

function ControlGroup({
  title, items, functions, savingKey, busyAll, failed, onHandle, dim,
}: {
  title: string;
  items: typeof FUNCTIONS;
  functions: FunctionStates;
  savingKey: FunctionKey | null;
  busyAll: boolean;
  failed: FunctionKey | null;
  onHandle: (k: FunctionKey) => void;
  dim?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <SectionHeader kicker={title} />
      <div className={cn("mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]", dim && "opacity-80")}>
        {items.map((f, i) => {
          const on = functions[f.key];
          const busy = savingKey === f.key || busyAll;
          return (
            <div
              key={f.key}
              className={cn("flex items-center gap-3 px-3.5 py-1.5", i > 0 && "border-t border-white/5")}
            >
              <span className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                on ? "border-purple-300/40 bg-purple-500/15 text-purple-100" : "border-white/10 bg-white/5 text-slate-500"
              )}>
                <Crosshair size={18} />
              </span>
              <div className="min-w-0 flex-1 py-1">
                <p className="truncate text-[14px] font-bold">{f.name}</p>
                <p className="truncate text-[11.5px] text-slate-400">{f.blurb} <span className="text-purple-300/70">· {f.tagline}</span></p>
                <p className={cn("text-[10.5px] font-black tracking-wider", on ? "text-emerald-300" : "text-slate-500")}>
                  {busy ? "SAVING…" : on ? "ON" : "OFF"}
                </p>
                {failed === f.key && <p className="text-[11px] text-red-400">Save failed — rolled back, tap to retry.</p>}
              </div>
              <Toggle label={`${f.name} ${on ? "on" : "off"}`} on={on} disabled={busy} onChange={() => onHandle(f.key)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ErrorStateInline() {
  return (
    <p className="pb-2 text-center text-[11px] text-slate-600">
      Changes save to your key instantly
    </p>
  );
}

/** Optimistic single toggle (persist + rollback + sound). */
export async function persistToggle(
  key: FunctionKey,
  next: boolean,
  current: FunctionStates,
  apply: (f: FunctionStates) => void,
  pushActivity: (a: ActivityEvent) => void
): Promise<void> {
  apply({ ...current, [key]: next }); // optimistic
  try {
    const res = await api.updateFunctions({ [key]: next });
    apply(res.functions);
    if (next) playOn(); else playOff();
    const meta = FUNCTIONS.find((f) => f.key === key);
    const nowIso = new Date().toISOString();
    pushActivity({
      id: `${Date.now()}-${key}`,
      at: fmtTime(nowIso),
      iso: nowIso,
      label: meta?.name ?? key,
      action: next ? "Enabled" : "Disabled",
      kind: next ? "enabled" : "disabled",
    });
  } catch (e) {
    apply(current); // rollback
    playError();
    throw e;
  }
}

/** Optimistic bulk update for the master control (single request + rollback + sound). */
export async function persistMany(
  next: FunctionStates,
  current: FunctionStates,
  apply: (f: FunctionStates) => void,
  pushActivity: (a: ActivityEvent) => void
): Promise<void> {
  const allOn = Object.values(next).every(Boolean);
  apply(next); // optimistic
  try {
    const res = await api.updateFunctions(next);
    apply(res.functions);
    if (allOn) playOn(); else playOff();
    const nowIso = new Date().toISOString();
    pushActivity({
      id: `${Date.now()}-all`,
      at: fmtTime(nowIso),
      iso: nowIso,
      label: allOn ? "All systems on" : "All systems off",
      action: "Bulk update",
      kind: allOn ? "enabled" : "disabled",
    });
  } catch (e) {
    apply(current); // rollback
    playError();
    throw e;
  }
}

