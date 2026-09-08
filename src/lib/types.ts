/** Centralized shared types for Zev Lock. */

export type LicenseStatus = "UNUSED" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "REVOKED";

export interface License {
  id: string;
  key: string;
  plan: string;
  status: LicenseStatus;
  device_limit: number;
  created_at: string;
  activated_at: string | null;
  expires_at: string | null;
}

export interface Device {
  id: string;
  license_id: string;
  device_identifier: string;
  platform: string;
  created_at: string;
  last_seen_at: string;
}

export interface Session {
  id: string;
  license_id: string;
  device_id: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

/** Virtual UI function keys — simulated toggles only, no game interaction. */
export const FUNCTION_KEYS = [
  "aimlock_head",
  "stability_assist",
  "aim_hold",
  "aim_lockdown",
  "sensitivity_boost",
  "screen_boost",
  "headshot_fix",
  "fix_recoil",
] as const;

export type FunctionKey = (typeof FUNCTION_KEYS)[number];

export type FunctionStates = Record<FunctionKey, boolean>;

export type FunctionGroup = "AIM ASSIST" | "PERFORMANCE";

export interface FunctionMeta {
  key: FunctionKey;
  name: string;
  tagline: string;
  group: FunctionGroup;
}

export const FUNCTIONS: FunctionMeta[] = [
  { key: "aimlock_head", name: "AimLock Head", tagline: "✓ Bám Đầu", group: "AIM ASSIST" },
  { key: "stability_assist", name: "Stability Assist", tagline: "✓ Nhẹ Tâm", group: "AIM ASSIST" },
  { key: "aim_hold", name: "Aim Hold", tagline: "✓ Ghim Tâm", group: "AIM ASSIST" },
  { key: "aim_lockdown", name: "Aim LockDown", tagline: "✓ Đầm Tâm", group: "AIM ASSIST" },
  { key: "sensitivity_boost", name: "Sensitivity Boost", tagline: "✓ Nhạy", group: "PERFORMANCE" },
  { key: "screen_boost", name: "Screen Boost", tagline: "✓ Buff Màn", group: "PERFORMANCE" },
  { key: "headshot_fix", name: "HeadShot Fix", tagline: "✓ Fix Lố Đầu", group: "PERFORMANCE" },
  { key: "fix_recoil", name: "Fix Recoil", tagline: "✓ Đỡ Giật", group: "PERFORMANCE" },
];

export interface ActivityEvent {
  id: string;
  at: string;
  iso?: string;
  label: string;
  action?: string;
  kind: "enabled" | "disabled" | "info";
}

export interface LicenseStatusResponse {
  license: Pick<License, "key" | "plan" | "status" | "expires_at" | "device_limit" | "activated_at">;
  device: { platform: string; status: "BOUND" | "UNBOUND"; last_seen_at: string | null };
  functions: FunctionStates;
  session_expires_at: string;
}

export interface ApiError {
  error: string;
  code?: string;
}
