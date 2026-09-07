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

export function Toggle({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative h-8 w-[52px] shrink-0 rounded-full border transition-colors duration-200",
        on ? "border-violet-400/60 bg-gradient-to-r from-violet-500 to-cyan-400" : "border-slate-600/60 bg-slate-800",
        disabled && "opacity-50"
      )}
      style={{ minWidth: 52, minHeight: 32 }}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 32 }}
        className={cn(
          "absolute top-[3px] h-[24px] w-[24px] rounded-full bg-white shadow",
          on ? "right-[3px]" : "left-[3px]"
        )}
      />
    </button>
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
