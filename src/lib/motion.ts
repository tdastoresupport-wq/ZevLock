/**
 * ZEV motion tokens — the single source of animation values.
 * Values match the established production feel; components must import
 * these instead of hardcoding durations, easings, or spring configs.
 * Transform + opacity only. Respects prefers-reduced-motion at usage sites
 * (MotionConfig reducedMotion="user" + CSS fallbacks in globals.css).
 */

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Seconds. press = tactile feedback, fast = page/row enter, base = modal, slow = hero. */
export const DUR = {
  press: 0.12,
  fast: 0.18,
  base: 0.25,
  slow: 0.4,
} as const;

/** Pixels of translate travel. */
export const DIST = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 16,
} as const;

/** Press scales (whileTap). */
export const PRESS = {
  soft: 0.985,
  std: 0.94,
  nav: 0.92,
  hard: 0.9,
} as const;

export const SPRING = {
  /** Bottom-nav pill + small indicators. */
  nav: { type: "spring", stiffness: 550, damping: 38 },
  /** Toggle knob travel — deterministic end state, retargets cleanly. */
  toggle: { type: "spring", stiffness: 650, damping: 30 },
  /** Toggle press squash. */
  toggleTap: { type: "spring", stiffness: 700, damping: 28 },
  /** Soft entrances (bars, rows, icons). */
  soft: { type: "spring", stiffness: 400, damping: 26 },
} as const;
