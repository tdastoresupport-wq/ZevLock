"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Server-authoritative license countdown.
 * Drift = Date.now() - serverNow_at_fetch; remaining = expiresAt - (now - drift).
 * Continuous across reload (re-anchored per fetch) and immune to device-clock
 * changes after fetch. Permanent licenses never count down.
 */
// ponytail: one hook, no date lib.
export function useLicenseCountdown(opts: {
  expiresAt: string | null;
  serverNow: string | null;
  isPermanent: boolean;
}): { label: string; expired: boolean } {
  const { expiresAt, serverNow, isPermanent } = opts;
  const driftRef = useRef<number | null>(null);
  if (driftRef.current === null && serverNow) {
    const srv = new Date(serverNow).getTime();
    if (!Number.isNaN(srv)) driftRef.current = Date.now() - srv;
  }
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (isPermanent || !expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isPermanent, expiresAt]);
  if (isPermanent) return { label: "Vĩnh viễn", expired: false };
  if (!expiresAt || driftRef.current === null) return { label: "—", expired: false };
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return { label: "—", expired: false };
  const remaining = exp - (now - driftRef.current);
  if (remaining <= 0) return { label: "Hết hạn", expired: true };
  return { label: formatRemaining(remaining), expired: false };
}

function formatRemaining(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
