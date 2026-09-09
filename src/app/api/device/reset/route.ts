import { NextRequest, NextResponse } from "next/server";
import { addLog, deleteDevicesForLicense, revokeSessionsForLicense } from "@/lib/db";
import { getSessionToken, verifySession, isUserSessionActive} from "@/lib/auth";

/**
 * POST /api/device/reset — user-initiated unbind of ALL devices on this
 * license (e.g. moved to a new iPhone). Session is revoked; user re-activates.
 */
export async function POST(req: NextRequest) {
  const token = getSessionToken(req);
  const claims = token ? await verifySession(token) : null;
  if (!claims) return NextResponse.json({ error: "Invalid or expired session", code: "session_invalid" }, { status: 401 });
  if (!(await isUserSessionActive(claims.sid))) return NextResponse.json({ error: "Session revoked", code: "session_revoked" }, { status: 401 });

  await deleteDevicesForLicense(claims.licenseId);
  await revokeSessionsForLicense(claims.licenseId);
  await addLog("device.reset", claims.licenseId, null, { by: "user" });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("zev_session");
  return res;
}
