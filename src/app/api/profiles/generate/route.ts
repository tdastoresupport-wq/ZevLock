import { NextRequest, NextResponse } from "next/server";
import { addLog, isPresetEnabled, listProfileEvents } from "@/lib/db";
import { getSessionToken, rateLimit, tooMany, verifySession, isUserSessionActive} from "@/lib/auth";
import { effectiveLicenseById } from "@/lib/license";
import { profilePresetSchema } from "@/lib/validation";
import { PROFILE_CONTENT_TYPE, validateMobileconfig } from "@/lib/mobileconfig";
import { CANONICAL_PROFILES } from "@/mobileconfig/profiles/bytes";

/**
 * POST /api/profiles/generate — legacy alias of /api/mobileconfig/generate.
 * Issues the canonical profile file bytes to this license (same audit,
 * same rate limits). Kept for backward compatibility.
 */
export async function POST(req: NextRequest) {
  const token = getSessionToken(req);
  const claims = token ? await verifySession(token) : null;
  if (!claims) return NextResponse.json({ error: "Invalid or expired session", code: "session_invalid" }, { status: 401 });
  if (!(await isUserSessionActive(claims.sid))) return NextResponse.json({ error: "Session revoked", code: "session_revoked" }, { status: 401 });
  if (!rateLimit(`profile:${claims.licenseId}`, 10, 3_600_000)) return tooMany();

  const body = await req.json().catch(() => ({}));
  const parsed = profilePresetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown profile preset", code: "invalid_preset" }, { status: 400 });
  }
  const preset = parsed.data.preset;

  const lic = await effectiveLicenseById(claims.licenseId);
  if (!lic || lic.status !== "ACTIVE") {
    return NextResponse.json({ error: "License is not active", code: "license_inactive" }, { status: 403 });
  }
  if (!(await isPresetEnabled(preset))) {
    return NextResponse.json({ error: "This preset is currently disabled", code: "preset_disabled" }, { status: 403 });
  }

  const file = CANONICAL_PROFILES[preset];
  if (!file) {
    return NextResponse.json({ error: "Could not build profile", code: "build_failed" }, { status: 500 });
  }
  const check = validateMobileconfig(file.xml, preset);
  if (!check.ok) {
    return NextResponse.json({ error: "Generated profile failed validation", code: "invalid_profile" }, { status: 500 });
  }

  await addLog("profile.created", lic.id, null, {
    preset,
    identifier: file.identifier,
    uuid: file.uuid,
  });

  return NextResponse.json({
    preset,
    filename: file.filename,
    contentType: PROFILE_CONTENT_TYPE,
    identifier: file.identifier,
    uuid: file.uuid,
    xml: file.xml,
    history: await listProfileEvents(lic.id, 20),
  });
}
