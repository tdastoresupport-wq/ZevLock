import { NextRequest, NextResponse } from "next/server";

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

export async function requireSession(req: NextRequest): Promise<SessionClaims | null> {
  const token = getSessionToken(req);
  if (!token) return null;
  return verifySession(token);
}

export function isAdmin(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("admin_token");
  const expected = process.env.ADMIN_API_TOKEN ?? "dev-only-admin-token-change-me";
  return !!token && token === expected;
}

export function unauthorized(code = "unauthorized") {
  return NextResponse.json({ error: "Unauthorized", code }, { status: 401 });
}

export function adminOnly(req: NextRequest): NextResponse | null {
  if (!isAdmin(req)) return unauthorized("admin_required");
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
