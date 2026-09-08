"use client";

/**
 * Tiny premium UI sounds synthesized with WebAudio — no audio assets.
 * - Created lazily on first user gesture; never autoplays.
 * - Global setting persisted in localStorage (`zev_sound`, default ON).
 */

const KEY = "zev_sound";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(KEY) !== "0";
}

export function setSoundEnabled(v: boolean): void {
  try {
    window.localStorage.setItem(KEY, v ? "1" : "0");
  } catch { /* ignore */ }
}

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, endFreq: number, durMs: number, gain: number, delayMs = 0): void {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + delayMs / 1000;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + durMs / 1000);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.02);
  } catch { /* ignore */ }
}

function guard(): boolean {
  return typeof window !== "undefined" && isSoundEnabled();
}

/* Throttle: at most one toggle sound per 150ms — rapid toggling stays
 * a single clean feedback stream instead of dozens of overlaps. */
let lastToggleAt = 0;
const TOGGLE_GAP_MS = 150;

function toggleGuard(): boolean {
  if (!guard()) return false;
  const t = Date.now();
  if (t - lastToggleAt < TOGGLE_GAP_MS) return false;
  lastToggleAt = t;
  return true;
}

/** Soft tick for taps / navigation. */
export function playClick(): void {
  if (!guard()) return;
  blip(620, 520, 28, 0.035);
}

/** Rising two-tone for enabling. Throttled — one event, one sound max. */
export function playOn(): void {
  if (!toggleGuard()) return;
  blip(440, 520, 45, 0.045);
  blip(660, 840, 60, 0.045, 45);
}

/** Falling two-tone for disabling. Throttled — one event, one sound max. */
export function playOff(): void {
  if (!toggleGuard()) return;
  blip(660, 560, 45, 0.045);
  blip(440, 330, 60, 0.045, 45);
}

/** Low blip for failed saves / rollbacks. Never throttled away silently —
 *  failures are rare, so each one deserves its feedback. */
export function playError(): void {
  if (!guard()) return;
  blip(220, 160, 90, 0.05);
}
