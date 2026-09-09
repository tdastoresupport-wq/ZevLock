import { NextRequest, NextResponse } from "next/server";
import { findDevice } from "@/lib/db";
import { effectiveLicenseById } from "@/lib/license";
import { getSessionToken, verifySession, isUserSessionActive} from "@/lib/auth";

/** GET /api/device/current — bound-device info for this session. */
export async function GET(req: NextRequest) {
  const token = getSessionToken(req);
  const claims = token ? await verifySession(token) : null;
  if (!claims) return NextResponse.json({ error: "Invalid or expired session", code: "session_invalid" }, { status: 401 });
  if (!(await isUserSessionActive(claims.sid))) return NextResponse.json({ error: "Session revoked", code: "session_revoked" }, { status: 401 });

  const lic = await effectiveLicenseById(claims.licenseId);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });

  const deviceIdentifier = req.nextUrl.searchParams.get("device_identifier");
  const device = deviceIdentifier ? await findDevice(lic.id, deviceIdentifier) : null;
  return NextResponse.json({
    device: device
      ? { platform: device.platform, status: "BOUND", last_seen_at: device.last_seen_at }
      : { platform: "iPhone", status: "UNBOUND", last_seen_at: null },
    device_limit: lic.device_limit,
  });
}
