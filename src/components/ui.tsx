"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("zev-card p-4", className)}>{children}</div>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-400">{children}</p>;
}

/** Compact section heading: kicker + optional right-side action. */
export function SectionHeader({ kicker, action }: { kicker: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-bold tracking-[0.22em] text-slate-400">{kicker}</p>
      {action}
    </div>
  );
}

export function StatusDot({ on }: { on: boolean }) {
  return <span className={cn("dot", on ? "dot-on" : "dot-off")} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="text-center py-8">
      <p className="text-sm text-slate-300">{message}</p>
      {onRetry && (
        <button className="zev-btn-ghost mt-4 px-6" onClick={onRetry}>
          Try again
        </button>
      )}
    </Card>
  );
}

/** Premium tactile switch: spring knob, press squash, glow when on. Hit area ≥ 44px.
 *  The knob moves on an explicit x transform (never layout/left-right class
 *  swaps), so rapid toggles always retarget to a deterministic end state. */
export function Toggle({ on, disabled, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange: () => void }) {
  return (
    <motion.button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 700, damping: 28 }}
      className={cn("relative flex h-11 w-[60px] shrink-0 items-center justify-center", disabled && "opacity-50")}
      style={{ minWidth: 60, minHeight: 44 }}
    >
      <span
        className={cn(
          "h-8 w-[52px] rounded-full border transition-colors duration-200",
          on
            ? "border-purple-300/60 bg-gradient-to-r from-violet-600 to-purple-400 shadow-[0_0_14px_rgba(168,85,247,0.45)]"
            : "border-slate-600/60 bg-slate-800"
        )}
      />
      <motion.span
        initial={false}
        animate={{ x: on ? 11 : -11 }}
        transition={{ type: "spring", stiffness: 650, damping: 30 }}
        style={{ marginLeft: -12, marginTop: -12 }}
        className={cn(
          "absolute left-1/2 top-1/2 h-6 w-6 rounded-full bg-white",
          on ? "shadow-[0_0_10px_rgba(255,255,255,0.7)]" : "shadow"
        )}
      />
    </motion.button>
  );
}

export function ConfirmDialog({
  title, body, confirmLabel = "Confirm", danger, onConfirm, onCancel,
}: {
  title: string; body: string; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="zev-card w-full max-w-[440px] p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{body}</p>
        <div className="mt-5 flex gap-3">
          <button className="zev-btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button
            disabled={busy}
            onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
            className={cn("flex-1 rounded-[14px] p-[11px] text-sm font-bold text-white", danger ? "bg-red-600" : "bg-violet-600")}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
