import { NextRequest, NextResponse } from "next/server";
import { addLog } from "@/lib/db";
import { isPresetEnabled } from "@/lib/db";
import { getSessionToken, rateLimit, tooMany, verifySession } from "@/lib/auth";
import { effectiveLicenseById } from "@/lib/license";
import { PROFILE_CONTENT_TYPE } from "@/lib/mobileconfig";
import { CANONICAL_PROFILES } from "@/mobileconfig/profiles/bytes";

/**
 * GET /api/mobileconfig/download?profile=<id> — serve the exact bytes of the
 * corresponding canonical .mobileconfig file.
 *
 * Server-side allowlist only: legacy-60hz, standard-oled-60hz,
 * promotion-high-hz. Unknown IDs → 404. The browser can never choose a
 * filesystem path or filename. Requires a valid session + ACTIVE license,
 * honors the admin preset flag, is rate-limited, and audited.
 */
export async function GET(req: NextRequest) {
  const token = getSessionToken(req);
  const claims = token ? await verifySession(token) : null;
  if (!claims) return NextResponse.json({ error: "Invalid or expired session", code: "session_invalid" }, { status: 401 });
  if (!rateLimit(`profile-dl:${claims.licenseId}`, 30, 3_600_000)) return tooMany();

  const id = req.nextUrl.searchParams.get("profile") ?? "";
  const file = CANONICAL_PROFILES[id];
  if (!file) return NextResponse.json({ error: "Unknown profile", code: "not_found" }, { status: 404 });

  const lic = await effectiveLicenseById(claims.licenseId);
  if (!lic || lic.status !== "ACTIVE") {
    return NextResponse.json({ error: "License is not active", code: "license_inactive" }, { status: 403 });
  }
  if (!(await isPresetEnabled(file.id))) {
    return NextResponse.json({ error: "This preset is currently disabled", code: "preset_disabled" }, { status: 403 });
  }

  await addLog("profile.downloaded", lic.id, null, { preset: file.id, uuid: file.uuid });
  return new NextResponse(file.xml, {
    status: 200,
    headers: {
      "Content-Type": PROFILE_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Content-Length": String(new TextEncoder().encode(file.xml).length),
      "Cache-Control": "no-store",
    },
  });
}
