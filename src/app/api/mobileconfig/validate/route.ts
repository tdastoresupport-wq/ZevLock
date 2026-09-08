import { NextRequest, NextResponse } from "next/server";
import { getSessionToken, rateLimit, tooMany, verifySession } from "@/lib/auth";
import { effectiveLicenseById } from "@/lib/license";
import { profilePresetSchema } from "@/lib/validation";
import {
  MOBILECONFIG_SCHEMA_VERSION,
  buildMobileconfig,
  validateMobileconfig,
  type ProfilePreset,
} from "@/lib/mobileconfig";

/**
 * POST /api/mobileconfig/validate — server-side validation report for a preset.
 * Only the preset ID is accepted (strict allowlist); the server rebuilds the
 * profile itself, so no arbitrary XML or plist keys can be injected.
 * Successful validations are NOT persisted (no history spam); failures are audited.
 */
export async function POST(req: NextRequest) {
  const token = getSessionToken(req);
  const claims = token ? await verifySession(token) : null;
  if (!claims) return NextResponse.json({ error: "Invalid or expired session", code: "session_invalid" }, { status: 401 });
  if (!rateLimit(`profile-validate:${claims.licenseId}`, 30, 3_600_000)) return tooMany();

  const body = await req.json().catch(() => ({}));
  const parsed = profilePresetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown profile preset", code: "invalid_preset" }, { status: 400 });
  }
  const lic = await effectiveLicenseById(claims.licenseId);
  if (!lic || lic.status !== "ACTIVE") {
    return NextResponse.json({ error: "License is not active", code: "license_inactive" }, { status: 403 });
  }

  const preset = parsed.data.preset as ProfilePreset;
  let profile;
  try {
    profile = buildMobileconfig({ preset, origin: req.nextUrl.origin });
  } catch {
    return NextResponse.json({ error: "Could not build profile", code: "build_failed" }, { status: 500 });
  }
  const check = validateMobileconfig(profile.xml, preset);
  return NextResponse.json({
    ok: check.ok,
    errors: check.errors,
    schemaVersion: MOBILECONFIG_SCHEMA_VERSION,
    identifier: profile.payloadIdentifier,
    uuid: profile.payloadUUID,
  });
}
