"use client";

import { useState } from "react";
import { CHARACTER_SRC } from "./HeroArt";
import { cn } from "@/lib/cn";

/**
 * Key/license avatar renderer. Accepts the same values the admin can set:
 * - null/undefined/"zev" → official ZEV character (fallback: initial)
 * - 1–4 chars ........... → generated initials
 * - https://... / data: → remote or uploaded image (rendered, never executed)
 */
export function KeyAvatar({
  value, name, size = 44,
}: {
  value?: string | null;
  name?: string | null;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const initial = (name?.trim()?.[0] ?? "Z").toUpperCase();

  const box = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-purple-300/40",
    "bg-gradient-to-br from-violet-700 to-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.35)]"
  );

  // Official character preset (or unset).
  if (!value || value === "zev") {
    return (
      <span className={box} style={{ width: size, height: size }}>
        {!broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={CHARACTER_SRC} alt="" className="h-full w-full object-cover" decoding="async" onError={() => setBroken(true)} />
        ) : (
          <span className="font-black text-white" style={{ fontSize: size * 0.42 }}>{initial}</span>
        )}
      </span>
    );
  }

  // Generated initials.
  if (/^[A-Za-z0-9 ]{1,4}$/.test(value)) {
    return (
      <span className={box} style={{ width: size, height: size }}>
        <span className="font-black text-white" style={{ fontSize: size * 0.36 }}>{value.trim().toUpperCase()}</span>
      </span>
    );
  }

  // Remote URL or uploaded data image.
  if (value.startsWith("https://") || value.startsWith("data:image/")) {
    return (
      <span className={box} style={{ width: size, height: size }}>
        {!broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" decoding="async" onError={() => setBroken(true)} />
        ) : (
          <span className="font-black text-white" style={{ fontSize: size * 0.42 }}>{initial}</span>
        )}
      </span>
    );
  }

  // Unknown value — never render raw, fall back to initial.
  return (
    <span className={box} style={{ width: size, height: size }}>
      <span className="font-black text-white" style={{ fontSize: size * 0.42 }}>{initial}</span>
    </span>
  );
}
