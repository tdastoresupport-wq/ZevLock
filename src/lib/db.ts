import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Device, FunctionStates, License } from "./types";

/**
 * D1 access layer.
 * - Production (Cloudflare Workers): uses the `DB` D1 binding.
 * - Local dev (`next dev` without bindings): falls back to an in-memory
 *   demo store seeded like `migrations/0002_seed.sql`, so UI/API work
 *   without Cloudflare. NOT for production.
 */

type D1 = {
  prepare: (query: string) => {
    bind: (...args: unknown[]) => {
      first: <T = Record<string, unknown>>() => Promise<T | null>;
      all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
      run: () => Promise<unknown>;
    };
  };
  batch: (stmts: unknown[]) => Promise<unknown>;
};

function getD1(): D1 | null {
  try {
    const ctx = getCloudflareContext();
    const db = (ctx.env as Record<string, unknown>).DB as D1 | undefined;
    return db ?? null;
  } catch {
    return null;
  }
}

export function hasD1(): boolean {
  return getD1() !== null;
}

/* ---------------- in-memory dev fallback (DEVELOPMENT ONLY) ---------------- */

const now = () => new Date().toISOString();

type MemDb = {
  licenses: Map<string, License>;
  devices: Map<string, Device>;
  sessions: Map<string, { id: string; license_id: string; device_id: string | null; expires_at: string; revoked_at: string | null }>;
  functions: Map<string, FunctionStates>;
  logs: { id: number; type: string; license_id: string | null; metadata: string | null; created_at: string }[];
};

const g = globalThis as unknown as { __zevMem?: MemDb };

function mem(): MemDb {
  if (!g.__zevMem) {
    g.__zevMem = {
      licenses: new Map([
        ["lic_demo_vip1", { id: "lic_demo_vip1", key: "ZEV-DEMO-2026-VIP1", plan: "PREMIUM VIP", status: "ACTIVE", device_limit: 1, created_at: "2026-01-10T08:00:00.000Z", activated_at: "2026-01-10T08:05:00.000Z", expires_at: "2031-03-16T00:00:00.000Z" }],
        ["lic_demo_expired", { id: "lic_demo_expired", key: "ZEV-EXP1-RED0-0001", plan: "PREMIUM VIP", status: "EXPIRED", device_limit: 1, created_at: "2025-01-10T08:00:00.000Z", activated_at: "2025-01-10T08:05:00.000Z", expires_at: "2025-02-10T00:00:00.000Z" }],
        ["lic_demo_unused", { id: "lic_demo_unused", key: "ZEV-NEW-USER-000001", plan: "PREMIUM VIP", status: "UNUSED", device_limit: 1, created_at: "2026-09-01T08:00:00.000Z", activated_at: null, expires_at: null }],
      ]),
      devices: new Map(),
      sessions: new Map(),
      functions: new Map([
        ["lic_demo_vip1", { aimlock_head: true, stability_assist: true, aim_hold: false, aim_lockdown: false, sensitivity_boost: false, screen_boost: false, headshot_fix: false }],
      ]),
      logs: [
        { id: 1, type: "license.activated", license_id: "lic_demo_vip1", metadata: '{"plan":"PREMIUM VIP"}', created_at: "2026-01-10T08:05:00.000Z" },
        { id: 2, type: "function.enabled", license_id: "lic_demo_vip1", metadata: '{"function":"aimlock_head"}', created_at: "2026-09-06T22:31:04.000Z" },
        { id: 3, type: "function.enabled", license_id: "lic_demo_vip1", metadata: '{"function":"stability_assist"}', created_at: "2026-09-06T22:31:17.000Z" },
        { id: 4, type: "function.disabled", license_id: "lic_demo_vip1", metadata: '{"function":"aim_hold"}', created_at: "2026-09-06T22:33:02.000Z" },
      ],
    };
  }
  return g.__zevMem;
}

export const dbIsFallback = () => getD1() === null;

/* ---------------- row helpers ---------------- */

function rowToLicense(r: Record<string, unknown>): License {
  return {
    id: String(r.id),
    key: String(r.key),
    plan: String(r.plan),
    status: r.status as License["status"],
    device_limit: Number(r.device_limit),
    created_at: String(r.created_at),
    activated_at: (r.activated_at as string | null) ?? null,
    expires_at: (r.expires_at as string | null) ?? null,
  };
}

const EMPTY_FUNCTIONS: FunctionStates = {
  aimlock_head: false, stability_assist: false, aim_hold: false, aim_lockdown: false,
  sensitivity_boost: false, screen_boost: false, headshot_fix: false,
};

function rowToFunctions(r: Record<string, unknown>): FunctionStates {
  return {
    aimlock_head: Number(r.aimlock_head) === 1,
    stability_assist: Number(r.stability_assist) === 1,
    aim_hold: Number(r.aim_hold) === 1,
    aim_lockdown: Number(r.aim_lockdown) === 1,
    sensitivity_boost: Number(r.sensitivity_boost) === 1,
    screen_boost: Number(r.screen_boost) === 1,
    headshot_fix: Number(r.headshot_fix) === 1,
  };
}

export const emptyFunctions = (): FunctionStates => ({ ...EMPTY_FUNCTIONS });

/* ---------------- queries ---------------- */

export async function findLicenseByKey(key: string): Promise<License | null> {
  const d1 = getD1();
  if (!d1) {
    const found = [...mem().licenses.values()].find((l) => l.key === key);
    return found ?? null;
  }
  const row = await d1.prepare("SELECT * FROM licenses WHERE key = ? LIMIT 1").bind(key).first<Record<string, unknown>>();
  return row ? rowToLicense(row) : null;
}

export async function findLicenseById(id: string): Promise<License | null> {
  const d1 = getD1();
  if (!d1) return mem().licenses.get(id) ?? null;
  const row = await d1.prepare("SELECT * FROM licenses WHERE id = ? LIMIT 1").bind(id).first<Record<string, unknown>>();
  return row ? rowToLicense(row) : null;
}

export async function listLicenses(opts: { search?: string; status?: string; plan?: string; limit: number; offset: number }): Promise<{ items: License[]; total: number }> {
  const d1 = getD1();
  if (!d1) {
    let items = [...mem().licenses.values()];
    if (opts.search) items = items.filter((l) => l.key.includes(opts.search!));
    if (opts.status) items = items.filter((l) => l.status === opts.status);
    if (opts.plan) items = items.filter((l) => l.plan === opts.plan);
    items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { items: items.slice(opts.offset, opts.offset + opts.limit), total: items.length };
  }
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.search) { where.push("key LIKE ?"); args.push(`%${opts.search}%`); }
  if (opts.status) { where.push("status = ?"); args.push(opts.status); }
  if (opts.plan) { where.push("plan = ?"); args.push(opts.plan); }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const count = await d1.prepare(`SELECT COUNT(*) AS c FROM licenses ${clause}`).bind(...args).first<{ c: number }>();
  const { results } = await d1.prepare(`SELECT * FROM licenses ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...args, opts.limit, opts.offset).all<Record<string, unknown>>();
  return { items: results.map(rowToLicense), total: Number(count?.c ?? 0) };
}

export async function insertLicense(l: License): Promise<void> {
  const d1 = getD1();
  if (!d1) { mem().licenses.set(l.id, l); return; }
  await d1.prepare(
    "INSERT INTO licenses (id, key, plan, status, device_limit, created_at, activated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(l.id, l.key, l.plan, l.status, l.device_limit, l.created_at, l.activated_at, l.expires_at).run();
}

export async function updateLicense(id: string, patch: Partial<Pick<License, "status" | "plan" | "device_limit" | "activated_at" | "expires_at">>): Promise<void> {
  const d1 = getD1();
  if (!d1) {
    const m = mem();
    const cur = m.licenses.get(id);
    if (cur) m.licenses.set(id, { ...cur, ...patch });
    return;
  }
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) { sets.push(`${k} = ?`); args.push(v); }
  if (!sets.length) return;
  await d1.prepare(`UPDATE licenses SET ${sets.join(", ")} WHERE id = ?`).bind(...args, id).run();
}

export async function deleteLicense(id: string): Promise<void> {
  const d1 = getD1();
  if (!d1) { mem().licenses.delete(id); return; }
  await d1.prepare("DELETE FROM licenses WHERE id = ?").bind(id).run();
}

export async function countDevices(licenseId: string): Promise<number> {
  const d1 = getD1();
  if (!d1) return [...mem().devices.values()].filter((d) => d.license_id === licenseId).length;
  const row = await d1.prepare("SELECT COUNT(*) AS c FROM devices WHERE license_id = ?").bind(licenseId).first<{ c: number }>();
  return Number(row?.c ?? 0);
}

export async function findDevice(licenseId: string, deviceIdentifier: string): Promise<Device | null> {
  const d1 = getD1();
  if (!d1) {
    const found = [...mem().devices.values()].find((d) => d.license_id === licenseId && d.device_identifier === deviceIdentifier);
    return found ?? null;
  }
  const row = await d1.prepare("SELECT * FROM devices WHERE license_id = ? AND device_identifier = ? LIMIT 1").bind(licenseId, deviceIdentifier).first<Device>();
  return row ?? null;
}

export async function upsertDevice(d: Device): Promise<void> {
  const d1 = getD1();
  if (!d1) { mem().devices.set(d.id, d); return; }
  await d1.prepare(
    `INSERT INTO devices (id, license_id, device_identifier, platform, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(license_id, device_identifier) DO UPDATE SET last_seen_at = excluded.last_seen_at, platform = excluded.platform`
  ).bind(d.id, d.license_id, d.device_identifier, d.platform, d.created_at, d.last_seen_at).run();
}

export async function deleteDevicesForLicense(licenseId: string): Promise<void> {
  const d1 = getD1();
  if (!d1) {
    const m = mem();
    for (const [id, d] of m.devices) if (d.license_id === licenseId) m.devices.delete(id);
    return;
  }
  await d1.prepare("DELETE FROM devices WHERE license_id = ?").bind(licenseId).run();
}

export async function listDevices(limit: number, offset: number): Promise<Device[]> {
  const d1 = getD1();
  if (!d1) return [...mem().devices.values()].slice(offset, offset + limit);
  const { results } = await d1.prepare("SELECT * FROM devices ORDER BY last_seen_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all<Device>();
  return results;
}

export async function getFunctions(licenseId: string): Promise<FunctionStates> {
  const d1 = getD1();
  if (!d1) return mem().functions.get(licenseId) ?? emptyFunctions();
  const row = await d1.prepare("SELECT * FROM function_states WHERE license_id = ? LIMIT 1").bind(licenseId).first<Record<string, unknown>>();
  return row ? rowToFunctions(row) : emptyFunctions();
}

export async function setFunctions(licenseId: string, deviceId: string | null, patch: Partial<FunctionStates>): Promise<FunctionStates> {
  const d1 = getD1();
  if (!d1) {
    const m = mem();
    const cur = m.functions.get(licenseId) ?? emptyFunctions();
    const next = { ...cur, ...patch };
    m.functions.set(licenseId, next);
    return next;
  }
  const cur = await getFunctions(licenseId);
  const next = { ...cur, ...patch };
  const toInt = (b: boolean) => (b ? 1 : 0);
  await d1.prepare(
    `INSERT INTO function_states (id, license_id, device_id, aimlock_head, stability_assist, aim_hold, aim_lockdown, sensitivity_boost, screen_boost, headshot_fix, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(license_id, device_id) DO UPDATE SET
       aimlock_head = excluded.aimlock_head, stability_assist = excluded.stability_assist,
       aim_hold = excluded.aim_hold, aim_lockdown = excluded.aim_lockdown,
       sensitivity_boost = excluded.sensitivity_boost, screen_boost = excluded.screen_boost,
       headshot_fix = excluded.headshot_fix, updated_at = excluded.updated_at`
  ).bind(
    `fs_${licenseId}_${deviceId ?? "shared"}`, licenseId, deviceId,
    toInt(next.aimlock_head), toInt(next.stability_assist), toInt(next.aim_hold),
    toInt(next.aim_lockdown), toInt(next.sensitivity_boost), toInt(next.screen_boost),
    toInt(next.headshot_fix), now()
  ).run();
  return next;
}

export async function createSession(s: { id: string; license_id: string; device_id: string | null; expires_at: string }): Promise<void> {
  const d1 = getD1();
  if (!d1) { mem().sessions.set(s.id, { ...s, revoked_at: null }); return; }
  await d1.prepare("INSERT INTO sessions (id, license_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").bind(s.id, s.license_id, s.device_id, now(), s.expires_at).run();
}

export async function revokeSessionsForLicense(licenseId: string): Promise<void> {
  const d1 = getD1();
  if (!d1) {
    for (const s of mem().sessions.values()) if (s.license_id === licenseId) s.revoked_at = now();
    return;
  }
  await d1.prepare("UPDATE sessions SET revoked_at = ? WHERE license_id = ? AND revoked_at IS NULL").bind(now(), licenseId).run();
}

export async function revokeSession(id: string): Promise<void> {
  const d1 = getD1();
  if (!d1) { const s = mem().sessions.get(id); if (s) s.revoked_at = now(); return; }
  await d1.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?").bind(now(), id).run();
}

export async function addLog(type: string, licenseId: string | null, deviceId: string | null, metadata: unknown): Promise<void> {
  const meta = typeof metadata === "string" ? metadata : JSON.stringify(metadata ?? {});
  const d1 = getD1();
  if (!d1) {
    const m = mem();
    m.logs.push({ id: m.logs.length + 1, type, license_id: licenseId, metadata: meta, created_at: now() });
    return;
  }
  await d1.prepare("INSERT INTO logs (type, license_id, device_id, metadata) VALUES (?, ?, ?, ?)").bind(type, licenseId, deviceId, meta).run();
}

export async function listLogs(limit: number, offset: number): Promise<{ id: number; type: string; license_id: string | null; metadata: string | null; created_at: string }[]> {
  const d1 = getD1();
  if (!d1) return [...mem().logs].reverse().slice(offset, offset + limit);
  const { results } = await d1.prepare("SELECT id, type, license_id, device_id, metadata, created_at FROM logs ORDER BY id DESC LIMIT ? OFFSET ?").bind(limit, offset).all<{ id: number; type: string; license_id: string | null; metadata: string | null; created_at: string }>();
  return results;
}

export async function adminStats(): Promise<{ licenses_total: number; licenses_active: number; devices_total: number; sessions_24h: number }> {
  const d1 = getD1();
  if (!d1) {
    const m = mem();
    return {
      licenses_total: m.licenses.size,
      licenses_active: [...m.licenses.values()].filter((l) => l.status === "ACTIVE").length,
      devices_total: m.devices.size,
      sessions_24h: m.sessions.size,
    };
  }
  const q = async (sql: string) => (await d1.prepare(sql).bind().first<{ c: number }>())?.c ?? 0;
  return {
    licenses_total: Number(await q("SELECT COUNT(*) AS c FROM licenses")),
    licenses_active: Number(await q("SELECT COUNT(*) AS c FROM licenses WHERE status = 'ACTIVE'")),
    devices_total: Number(await q("SELECT COUNT(*) AS c FROM devices")),
    sessions_24h: Number(await q("SELECT COUNT(*) AS c FROM sessions WHERE created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')")),
  };
}
