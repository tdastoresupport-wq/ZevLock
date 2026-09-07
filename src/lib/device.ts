"use client";

/**
 * Privacy-conscious device identifier for a WEB app (no fingerprinting).
 * - Random UUID persisted in localStorage (`zev_device_id`).
 * - Platform label derived from UA hints (iPhone/iPad/Desktop) — display only.
 * This satisfies "bind device" semantics without invasive tracking.
 */

const KEY = "zev_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = `web_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

export function getPlatform(): string {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  return "Web";
}
