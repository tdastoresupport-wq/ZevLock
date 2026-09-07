"use client";

import { useState } from "react";
import { Crosshair } from "lucide-react";
import { Card, Toggle } from "./ui";
import { api } from "@/lib/api";
import { FUNCTIONS, type ActivityEvent, type FunctionKey, type FunctionStates } from "@/lib/types";
import { fmtTime } from "@/lib/format";

/**
 * Function tab — VIRTUAL / SIMULATED toggles only.
 * Toggling persists state to the backend (D1) and never interacts
 * with any game, process, memory, or external system.
 */
export function FunctionTab({
  functions, savingKey, onToggle,
}: {
  functions: FunctionStates | null;
  savingKey: FunctionKey | null;
  onToggle: (key: FunctionKey, next: boolean, pushActivity: (a: ActivityEvent) => void) => Promise<void>;
  pushActivity: (a: ActivityEvent) => void;
}) {
  const [failed, setFailed] = useState<FunctionKey | null>(null);

  async function handle(key: FunctionKey) {
    if (!functions || savingKey) return;
    setFailed(null);
    try {
      await onToggle(key, !functions[key], () => {});
    } catch {
      setFailed(key);
    }
  }

  return (
    <div className="space-y-3">
      <div className="pt-1">
        <h1 className="text-[22px] font-black">Function</h1>
        <p className="mt-0.5 text-[12px] text-slate-400">Simulated presets — saved to your license.</p>
      </div>

      {FUNCTIONS.map((f) => {
        const on = functions?.[f.key] ?? false;
        const busy = savingKey === f.key;
        return (
          <Card key={f.key} className="flex items-center gap-3 p-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${on ? "border-violet-400/40 bg-violet-500/15 text-violet-200" : "border-white/10 bg-white/5 text-slate-400"}`}>
              <Crosshair size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold">{f.name}</p>
              <p className="text-[12px] text-cyan-300/80">{f.tagline}</p>
              <p className={`mt-0.5 text-[11px] font-bold ${on ? "text-emerald-300" : "text-slate-500"}`}>
                {busy ? "SAVING…" : on ? "ON" : "OFF"}
              </p>
              {failed === f.key && <p className="text-[11px] text-red-400">Save failed — rolled back, tap to retry.</p>}
            </div>
            <Toggle on={on} disabled={busy || !functions} onChange={() => void handle(f.key)} />
          </Card>
        );
      })}
    </div>
  );
}

/** Optimistic toggle helper used by the app shell (persist + rollback). */
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
    const meta = FUNCTIONS.find((f) => f.key === key);
    pushActivity({
      id: `${Date.now()}-${key}`,
      at: fmtTime(new Date().toISOString()),
      label: `${meta?.name ?? key} ${next ? "enabled" : "disabled"}`,
      kind: next ? "enabled" : "disabled",
    });
  } catch (e) {
    apply(current); // rollback
    throw e;
  }
}
