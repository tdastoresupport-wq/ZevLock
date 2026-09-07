import { NextRequest, NextResponse } from "next/server";
import { getFunctions } from "@/lib/db";
import { effectiveLicenseById } from "@/lib/license";
import { getSessionToken, verifySession } from "@/lib/auth";

/** GET /api/functions — persisted virtual function states for this license. */
export async function GET(req: NextRequest) {
  const token = getSessionToken(req);
  const claims = token ? await verifySession(token) : null;
  if (!claims) return NextResponse.json({ error: "Invalid or expired session", code: "session_invalid" }, { status: 401 });

  const lic = await effectiveLicenseById(claims.licenseId);
  if (!lic || lic.status !== "ACTIVE") {
    return NextResponse.json({ error: "License is not active", code: "license_inactive" }, { status: 403 });
  }
  return NextResponse.json({ functions: await getFunctions(lic.id) });
}
