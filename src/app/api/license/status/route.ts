import { NextRequest, NextResponse } from "next/server";
import { findDevice, getFunctions } from "@/lib/db";
import { effectiveLicenseById } from "@/lib/license";
import { getSessionToken, verifySession } from "@/lib/auth";
import type { LicenseStatusResponse } from "@/lib/types";

/** GET /api/license/status — current license + device + function snapshot. */
export async function GET(req: NextRequest) {
  const token = getSessionToken(req);
  const claims = token ? await verifySession(token) : null;
  if (!claims) return NextResponse.json({ error: "Invalid or expired session", code: "session_invalid" }, { status: 401 });

  // Device identifier is echoed back by the client for display binding.
  const deviceIdentifier = req.nextUrl.searchParams.get("device_identifier");
  const lic = await effectiveLicenseById(claims.licenseId);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });
  if (lic.status !== "ACTIVE") {
    return NextResponse.json({ error: `License is ${lic.status}`, code: lic.status.toLowerCase() }, { status: 403 });
  }

  const device = deviceIdentifier ? await findDevice(lic.id, deviceIdentifier) : null;
  const functions = await getFunctions(lic.id);
  const payload: LicenseStatusResponse = {
    license: {
      key: lic.key, plan: lic.plan, status: lic.status,
      expires_at: lic.expires_at, device_limit: lic.device_limit, activated_at: lic.activated_at,
    },
    device: {
      platform: device?.platform ?? "iPhone",
      status: device ? "BOUND" : "UNBOUND",
      last_seen_at: device?.last_seen_at ?? null,
    },
    functions,
    session_expires_at: new Date(claims.exp * 1000).toISOString(),
  };
  return NextResponse.json(payload);
}
