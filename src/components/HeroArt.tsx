"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Character artwork banner.
 * Artwork lives at `public/zev-character.png` — until then a
 * purple gradient + glow fallback is shown (no broken UI).
 */
export const CHARACTER_SRC = "/zev-character.png";

export function HeroArt({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [missing, setMissing] = useState(false);
  return (
    <div className={cn("zev-hero", className)}>
      <div className="zev-hero-glow" />
      {!missing && (
        // Plain <img> on purpose: the artwork file may not exist yet and
        // next/image cannot handle a runtime-missing local file gracefully.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={CHARACTER_SRC} alt="Zev character artwork" decoding="async" onError={() => setMissing(true)} />
      )}
      {children && <div className="absolute inset-0 z-10 flex flex-col justify-end p-4">{children}</div>}
    </div>
  );
}

/** Circular app avatar (uses the same character artwork, initial fallback). */
export function Avatar({ size = 40 }: { size?: number }) {
  const [missing, setMissing] = useState(false);
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-purple-300/40 bg-gradient-to-br from-violet-700 to-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.45)]"
      style={{ width: size, height: size }}
    >
      {!missing ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={CHARACTER_SRC} alt="Zev" className="h-full w-full object-cover" decoding="async" onError={() => setMissing(true)} />
      ) : (
        <span className="font-black text-white" style={{ fontSize: size * 0.42 }}>Z</span>
      )}
    </div>
  );
}
