"use client";

import { motion } from "framer-motion";
import { Home, SlidersHorizontal, Activity } from "lucide-react";
import { playClick } from "@/lib/sound";
import { cn } from "@/lib/cn";

export type Tab = "home" | "function" | "realtime";

const ITEMS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "function", label: "Function", icon: SlidersHorizontal },
  { id: "realtime", label: "Realtime", icon: Activity },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="zev-tabbar fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2" aria-label="Primary">
      <div className="grid grid-cols-3 px-4">
        {ITEMS.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => { if (!active) playClick(); onChange(item.id); }}
              className="flex flex-col items-center gap-1 py-1.5"
              style={{ minHeight: 56 }}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative flex h-8 w-16 items-center justify-center">
                {active && (
                  <motion.span
                    layoutId="zev-nav-pill"
                    transition={{ type: "spring", stiffness: 550, damping: 38 }}
                    className="absolute inset-0 rounded-full bg-purple-500/20 shadow-[0_0_14px_rgba(168,85,247,0.25)]"
                  />
                )}
                <Icon size={21} strokeWidth={active ? 2.4 : 2} className={cn("relative", active ? "text-purple-200" : "text-slate-500")} />
              </span>
              <span className={cn("text-[11px] font-semibold", active ? "text-white" : "text-slate-500")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
