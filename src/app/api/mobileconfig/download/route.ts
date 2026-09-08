import { NextRequest, NextResponse } from "next/server";
import { addLog, findProfileByUuid } from "@/lib/db";
import { getSessionToken, rateLimit, tooMany, verifySession } from "@/lib/auth";
import { effectiveLicenseById } from "@/lib/license";
import { profileUuidSchema } from "@/lib/validation";
import { PROFILE_CONTENT_TYPE, filenameFor } from "@/lib/mobileconfig";

/**
 * GET /api/mobileconfig/download?uuid=… — serve this license's own generated
 * profile bytes with download headers. The uuid must belong to the caller's
 * license (IDOR-safe); filename comes from the preset allowlist only.
 */
export async function GET(req: NextRequest) {
  const token = getSessionToken(req);
  const claims = token ? await verifySession(token) : null;
  if (!claims) return NextResponse.json({ error: "Invalid or expired session", code: "session_invalid" }, { status: 401 });
  if (!rateLimit(`profile-dl:${claims.licenseId}`, 30, 3_600_000)) return tooMany();

  const parsed = profileUuidSchema.safeParse({ uuid: req.nextUrl.searchParams.get("uuid") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown profile", code: "not_found" }, { status: 404 });
  }
  const lic = await effectiveLicenseById(claims.licenseId);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });

  const found = await findProfileByUuid(lic.id, parsed.data.uuid);
  if (!found) return NextResponse.json({ error: "Unknown profile", code: "not_found" }, { status: 404 });

  await addLog("profile.downloaded", lic.id, null, { preset: found.preset, uuid: found.uuid });
  return new NextResponse(found.xml, {
    status: 200,
    headers: {
      "Content-Type": PROFILE_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${filenameFor(found.preset as "legacy" | "standard" | "high-hz")}"`,
      "Content-Length": String(new TextEncoder().encode(found.xml).length),
      "Cache-Control": "no-store",
    },
  });
}
