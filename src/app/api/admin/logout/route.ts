import { NextRequest, NextResponse } from "next/server";
import { revokeAdminSession } from "@/lib/db";
import { getAdminToken, verifyAdminToken } from "@/lib/auth";

/** POST /api/admin/logout — revoke the server-side admin session, clear cookie. */
export async function POST(req: NextRequest) {
  // Parse crypto-only (no liveness requirement): logout must work even if the
  // session was already revoked — it is idempotent by design.
  const raw = getAdminToken(req);
  const claims = raw ? await verifyAdminToken(raw) : null;
  if (claims) {
    await revokeAdminSession(`admin:${claims.id}`);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("zev_admin");
  return res;
}
