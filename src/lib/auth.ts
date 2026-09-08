import { NextRequest, NextResponse } from "next/server";
import type { AdminRole } from "./types";

/**
 * Session tokens: HMAC-signed `sid.licenseId.exp` triplets (base64url).
 * Sent as HttpOnly cookie `zev_session` AND accepted via `Authorization: Bearer`
 * (iOS PWA-safe fallback). Stateless verification — no DB lookup on read.
 */

const encoder = new TextEncoder();

function b64urlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? encoder.encode(data) : data;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(msg));
  return b64urlEncode(new Uint8Array(sig));
}

function getSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-only-session-secret-change-me-32-chars-min";
}

export interface SessionClaims { sid: string; licenseId: string; exp: number }

export async function signSession(sid: string, licenseId: string, ttlSeconds: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${b64urlEncode(sid)}.${b64urlEncode(licenseId)}.${b64urlEncode(String(exp))}`;
  const sig = await hmac(getSecret(), payload);
  return `${payload}.${sig}`;
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const [a, b, c, sig] = token.split(".");
    if (!a || !b || !c || !sig) return null;
    const payload = `${a}.${b}.${c}`;
    const expected = await hmac(getSecret(), payload);
    if (expected !== sig) return null;
    const dec = (s: string) => new TextDecoder().decode(b64urlDecode(s));
    const claims = { sid: dec(a), licenseId: dec(b), exp: Number(dec(c)) };
    if (!claims.sid || !claims.licenseId || !Number.isFinite(claims.exp)) return null;
    if (claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

export function getSessionToken(req: NextRequest): string | null {
  const cookie = req.cookies.get("zev_session")?.value;
  if (cookie) return cookie;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

/** Admin credential: HttpOnly cookie `zev_admin` or `x-admin-token` header.
 *  Query-param tokens are intentionally NOT accepted (they leak into logs). */
export function getAdminToken(req: NextRequest): string | null {
  const cookie = req.cookies.get("zev_admin")?.value;
  if (cookie) return cookie;
  const header = req.headers.get("x-admin-token");
  if (header) return header;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

/** Constant-time string comparison (prevents timing side-channels on secrets). */
export function safeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export async function requireSession(req: NextRequest): Promise<SessionClaims | null> {
  const token = getSessionToken(req);
  if (!token) return null;
  return verifySession(token);
}

export function unauthorized(code = "unauthorized") {
  return NextResponse.json({ error: "Unauthorized", code }, { status: 401 });
}

/* ---------------- admin authentication (password + roles) ---------------- */

export interface AdminClaims {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

const ADMIN_TTL_SECONDS = 12 * 3600;

const ROLE_RANK: Record<AdminRole, number> = { SUPPORT: 1, ADMIN: 2, SUPER_ADMIN: 3 };

function parseRole(r: string): AdminRole | null {
  return r === "SUPER_ADMIN" || r === "ADMIN" || r === "SUPPORT" ? r : null;
}

/** Issue a signed admin session token (12h). Stateless, HttpOnly-cookie safe. */
export async function signAdminToken(a: AdminClaims): Promise<string> {
  return signSession(`admin:${a.id}`, `role:${a.role}|${a.email}|${a.name}`, ADMIN_TTL_SECONDS);
}

export async function verifyAdminToken(token: string): Promise<AdminClaims | null> {
  const c = await verifySession(token);
  if (!c || !c.sid.startsWith("admin:")) return null;
  const rest = c.licenseId.startsWith("role:") ? c.licenseId.slice(5) : "";
  const [roleRaw, email = "", name = ""] = rest.split("|");
  const role = parseRole(roleRaw);
  if (!role) return null;
  return { id: c.sid.slice(6), email, name, role };
}

/** Resolve the calling admin from cookie/header, or legacy static token. */
export async function getAdmin(req: NextRequest): Promise<AdminClaims | null> {
  const cookie = req.cookies.get("zev_admin")?.value ?? null;
  const header = req.headers.get("x-admin-token") ?? null;
  for (const t of [cookie, header]) {
    if (!t) continue;
    const v = await verifyAdminToken(t);
    if (v) return v;
  }
  // Legacy static token (transition path for scripts) → pseudo super-admin.
  const expected = process.env.ADMIN_API_TOKEN ?? "";
  for (const t of [cookie, header]) {
    if (t && expected && safeEqual(t, expected)) {
      return { id: "legacy", email: "", name: "Legacy token", role: "SUPER_ADMIN" };
    }
  }
  return null;
}

/** Authorization gate. Destructive endpoints should require "ADMIN". */
export async function adminOnly(req: NextRequest, minRole: AdminRole = "SUPPORT"): Promise<NextResponse | null> {
  const a = await getAdmin(req);
  if (!a || ROLE_RANK[a.role] < ROLE_RANK[minRole]) return unauthorized("admin_required");
  return null;
}

/* ---- minimal in-memory rate limiter (per Worker isolate) ---- */
const hits = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const nowMs = Date.now();
  const cur = hits.get(key);
  if (!cur || cur.reset < nowMs) {
    hits.set(key, { n: 1, reset: nowMs + windowMs });
    return true;
  }
  cur.n += 1;
  return cur.n <= limit;
}

export function tooMany() {
  return NextResponse.json({ error: "Rate limited, try again shortly", code: "rate_limited" }, { status: 429 });
}
