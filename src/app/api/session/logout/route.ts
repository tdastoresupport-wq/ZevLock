import { NextRequest, NextResponse } from "next/server";
import { addLog, revokeSession } from "@/lib/db";
import { getSessionToken, verifySession } from "@/lib/auth";

/** POST /api/session/logout — revoke session, clear cookie. */
export async function POST(req: NextRequest) {
  const token = getSessionToken(req);
  const claims = token ? await verifySession(token) : null;
  if (claims) {
    await revokeSession(claims.sid);
    await addLog("session.revoked", claims.licenseId, null, { by: "user" });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("zev_session");
  return res;
}
