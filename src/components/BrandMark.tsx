"use client";

import { useId } from "react";

/**
 * Official ZEV brand mark: purple circular Z.
 * Used sparingly — splash, login, favicon, loading, admin sign-in.
 * (The white-haired character remains the avatar; see HeroArt.)
 */
export function BrandMark({ size = 76 }: { size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="ZEV logo">
      <defs>
        <linearGradient id={`zevb-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.6" stopColor="#a855f7" />
          <stop offset="1" stopColor="#d8b4fe" />
        </linearGradient>
        <radialGradient id={`zevg-${id}`} cx="0.5" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#1b1440" />
          <stop offset="1" stopColor="#070912" />
        </radialGradient>
      </defs>
      <circle cx="48" cy="48" r="44" fill={`url(#zevg-${id})`} stroke={`url(#zevb-${id})`} strokeWidth="5" />
      <circle cx="48" cy="48" r="36.5" fill="none" stroke="#a855f7" strokeOpacity="0.25" strokeWidth="1" />
      <text
        x="48" y="64" textAnchor="middle"
        fontFamily="system-ui,-apple-system,sans-serif" fontWeight={900} fontSize="44" fill="#ffffff"
      >
        Z
      </text>
      <circle cx="70" cy="28" r="4" fill="#d8b4fe" />
    </svg>
  );
}
