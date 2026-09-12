"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

/** Animated system-health ring: the visual focal point of Home. */
export function HealthRing({ active, total }: { active: number; total: number }) {
  const reduce = useReducedMotion();
  const progress = useMotionValue(total === 0 ? 0 : active / total);
  const count = useMotionValue(active);
  const rounded = useTransform(count, (v) => `${Math.round(v)}`);

  useEffect(() => {
    const target = total === 0 ? 0 : active / total;
    const controls = animate(progress, target, { duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] });
    const controls2 = animate(count, active, { duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] });
    return () => { controls.stop(); controls2.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, total, reduce]);

  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = useTransform(progress, (p) => `${p * C} ${C}`);

  const label = active === total && total > 0 ? "TỐI ƯU" : active === 0 ? "NGHỈ" : "HOẠT ĐỘNG";

  return (
    <div className="flex items-center gap-4" role="img" aria-label={`Sức khỏe hệ thống ${label}, ${active} trên ${total} đang bật`}>
      <div className="relative h-[132px] w-[132px] shrink-0">
        <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
          <circle cx="66" cy="66" r={R} fill="none" stroke="rgba(148,163,255,0.12)" strokeWidth="10" />
          <motion.circle
            cx="66" cy="66" r={R} fill="none"
            stroke="url(#zev-ring-grad)" strokeWidth="10" strokeLinecap="round"
            style={{ strokeDasharray: dash, filter: "drop-shadow(0 0 6px rgba(168,85,247,0.55))" }}
          />
          <defs>
            <linearGradient id="zev-ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7c3aed" />
              <stop offset="1" stopColor="#c084fc" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          <p className="text-[26px] font-black tabular-nums leading-none">
            <motion.span>{rounded}</motion.span>
            <span className="text-sm font-bold text-slate-400">/{total}</span>
          </p>
          <p className="mt-1 text-[10px] font-black tracking-[0.22em] text-emerald-300">{label}</p>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-[0.2em] text-slate-400">SỨC KHỎE HỆ THỐNG</p>
        <p className="mt-1 text-[15px] font-bold leading-snug">
          {active === total && total > 0 ? "Mọi thứ đang bật." : active === 0 ? "Mọi thứ đang tắt." : `${active} trên ${total} đang bật.`}
        </p>
        <p className="mt-1 text-[12px] text-slate-400">Preset trên key này</p>
      </div>
    </div>
  );
}
