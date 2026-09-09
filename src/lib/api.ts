import type { ApiError, FunctionStates, LicenseStatusResponse } from "./types";

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * Bounded fetch: every startup/network request aborts after a finite timeout
 * so no single request can hold the splash screen indefinitely.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 12000
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** localStorage read that can never throw (private-mode SecurityError, etc.). */
export function storageGet(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function token(): string | null {
  return storageGet("zev_token");
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(path, {
    ...init,
    headers: { ...JSON_HEADERS, ...headers },
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as T & ApiError;
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  checkLicense: (key: string) =>
    req<{ status: string; plan?: string; expires_at?: string | null }>(`/api/license/check`, {
      method: "POST",
      body: JSON.stringify({ key }),
    }),

  activateLicense: (key: string, device_identifier: string, platform: string) =>
    req<{ token: string; expires_at: string }>(`/api/license/activate`, {
      method: "POST",
      body: JSON.stringify({ key, device_identifier, platform }),
    }),

  licenseStatus: () => req<LicenseStatusResponse>(`/api/license/status`),

  getFunctions: () => req<{ functions: FunctionStates }>(`/api/functions`),

  updateFunctions: (states: Partial<FunctionStates>) =>
    req<{ functions: FunctionStates }>(`/api/functions/update`, {
      method: "POST",
      body: JSON.stringify({ states }),
    }),

  logout: () => req<{ ok: true }>(`/api/session/logout`, { method: "POST" }),

  deviceReset: () => req<{ ok: true }>(`/api/device/reset`, { method: "POST" }),

  deviceCurrent: () => req<{ device: unknown }>(`/api/device/current`),

  saveToken: (t: string) => window.localStorage.setItem("zev_token", t),
  clearToken: () => window.localStorage.removeItem("zev_token"),
};

export function adminHeaders(): Record<string, string> {
  const t = storageGet("zev_admin_token");
  return t ? { "x-admin-token": t } : {};
}

export async function adminReq<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { ...JSON_HEADERS, ...adminHeaders(), ...((init?.headers as Record<string, string>) ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & ApiError;
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const adminAuth = {
  login: (email: string, password: string) =>
    adminReq<{ token: string; admin: { id: string; email: string; name: string; role: string } }>(
      `/api/admin/login`, { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  me: () => adminReq<{ admin: { id: string; email: string; name: string; role: string } }>(`/api/admin/me`),
  logout: () => adminReq<{ ok: true }>(`/api/admin/logout`, { method: "POST" }),
};

export interface ProfileHistoryItem {
  preset: string;
  identifier: string;
  uuid: string;
  created_at: string;
  downloaded: boolean;
}

export interface GeneratedProfile {
  preset: string;
  filename: string;
  contentType: string;
  identifier: string;
  uuid: string;
  xml: string;
  history: ProfileHistoryItem[];
}

export const profiles = {
  generate: (preset: string) =>
    req<GeneratedProfile>(`/api/mobileconfig/generate`, {
      method: "POST",
      body: JSON.stringify({ preset }),
    }),
  validate: (preset: string) =>
    req<{ ok: boolean; errors: string[]; schemaVersion: string; identifier: string; uuid: string }>(
      `/api/mobileconfig/validate`, { method: "POST", body: JSON.stringify({ preset }) }
    ),
  downloadUrl: (preset: string) => `/api/mobileconfig/download?profile=${encodeURIComponent(preset)}`,
  history: () => req<{ items: ProfileHistoryItem[] }>(`/api/mobileconfig/history`),
};
