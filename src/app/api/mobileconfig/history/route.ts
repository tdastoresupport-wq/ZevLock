import { NextRequest, NextResponse } from "next/server";
import { listProfileEvents } from "@/lib/db";
import { getSessionToken, verifySession } from "@/lib/auth";
import { effectiveLicenseById } from "@/lib/license";

/** GET /api/mobileconfig/history — this license's generated profiles. */
export async function GET(req: NextRequest) {
  const token = getSessionToken(req);
  const claims = token ? await verifySession(token) : null;
  if (!claims) return NextResponse.json({ error: "Invalid or expired session", code: "session_invalid" }, { status: 401 });
  const lic = await effectiveLicenseById(claims.licenseId);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });
  return NextResponse.json({ items: await listProfileEvents(lic.id, 20) });
}
