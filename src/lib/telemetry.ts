"use client";

/**
 * Layered device telemetry — Layer 1: legitimate browser APIs only.
 * Every field is either a real measured value or null ("Unavailable").
 * Nothing is estimated, interpolated, or fabricated.
 */

export interface DeviceTelemetry {
  cores: number | null;
  memoryGB: number | null;
  screen: string | null;
  online: boolean;
  network: string | null;
}

interface NavExtras {
  deviceMemory?: number;
  connection?: { effectiveType?: string; downlink?: number; rtt?: number };
  getBattery?: () => Promise<{ level: number; charging: boolean }>;
}

export interface BatteryInfo {
  level: number; // 0..1
  charging: boolean;
}

export function getTelemetry(): DeviceTelemetry {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { cores: null, memoryGB: null, screen: null, online: true, network: null };
  }
  const nav = navigator as Navigator & NavExtras;
  const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null;
  const memoryGB = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
  const screen =
    typeof window.screen !== "undefined" && window.screen.width > 0
      ? `${window.screen.width}×${window.screen.height}${window.devicePixelRatio > 1 ? ` @${window.devicePixelRatio}x` : ""}`
      : null;
  const conn = nav.connection;
  const network = conn?.effectiveType
    ? `${conn.effectiveType}${typeof conn.downlink === "number" ? ` · ${conn.downlink}Mb/s` : ""}`
    : null;
  return { cores, memoryGB, screen, online: nav.onLine, network };
}

/** Battery Status API — supported in Chromium; null elsewhere. Must be honest about gaps. */
export async function getBatteryInfo(): Promise<BatteryInfo | null> {
  try {
    const nav = navigator as Navigator & NavExtras;
    if (!nav.getBattery) return null;
    const b = await nav.getBattery();
    if (typeof b.level !== "number") return null;
    return { level: b.level, charging: !!b.charging };
  } catch {
    return null;
  }
}

/** Live online/offline subscription. Returns an unsubscribe function. */
export function subscribeOnline(cb: (online: boolean) => void): () => void {
  const on = () => cb(true);
  const off = () => cb(false);
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  return () => {
    window.removeEventListener("online", on);
    window.removeEventListener("offline", off);
  };
}
