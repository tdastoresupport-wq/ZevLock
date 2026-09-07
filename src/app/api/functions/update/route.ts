import { NextRequest, NextResponse } from "next/server";
import { addLog, getFunctions, setFunctions } from "@/lib/db";
import { effectiveLicenseById } from "@/lib/license";
import { getSessionToken, rateLimit, tooMany, verifySession } from "@/lib/auth";
import { updateFunctionsSchema } from "@/lib/validation";
import type { FunctionKey } from "@/lib/types";

/**
 * POST /api/functions/update — persist virtual UI function toggles.
 * These toggles ONLY change app state in D1. They never touch games,
 * processes, memory, or any external system.
 */
export async function POST(req: NextRequest) {
  const token = getSessionToken(req);
  const claims = token ? await verifySession(token) : null;
  if (!claims) return NextResponse.json({ error: "Invalid or expired session", code: "session_invalid" }, { status: 401 });
  if (!rateLimit(`fn:${claims.licenseId}`, 30, 60_000)) return tooMany();

  const body = await req.json().catch(() => ({}));
  const parsed = updateFunctionsSchema.safeParse(body);
  if (!parsed.success || !parsed.data.states || Object.keys(parsed.data.states).length === 0) {
    return NextResponse.json({ error: "No valid function states provided", code: "invalid_request" }, { status: 400 });
  }

  const lic = await effectiveLicenseById(claims.licenseId);
  if (!lic || lic.status !== "ACTIVE") {
    return NextResponse.json({ error: "License is not active", code: "license_inactive" }, { status: 403 });
  }

  const before = await getFunctions(lic.id);
  const next = await setFunctions(lic.id, null, parsed.data.states);
  // Audit-log every changed toggle (drives the Realtime activity timeline).
  for (const [k, v] of Object.entries(parsed.data.states)) {
    const key = k as FunctionKey;
    if (before[key] !== v) {
      await addLog(v ? "function.enabled" : "function.disabled", lic.id, null, { function: key });
    }
  }
  return NextResponse.json({ functions: next });
}
