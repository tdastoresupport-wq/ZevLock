import { NextRequest, NextResponse } from "next/server";
import { getSessionToken, rateLimit, tooMany, verifySession, isUserSessionActive} from "@/lib/auth";
import { effectiveLicenseById } from "@/lib/license";
import { profilePresetSchema } from "@/lib/validation";
import { MOBILECONFIG_SCHEMA_VERSION, validateMobileconfig } from "@/lib/mobileconfig";
import { CANONICAL_PROFILES } from "@/mobileconfig/profiles/bytes";

/**
 * POST /api/mobileconfig/validate — server-side validation report for a preset.
 * Only the preset ID is accepted (strict allowlist); the canonical file bytes
 * are validated, so no arbitrary XML or plist keys can be injected.
 * Successful validations are NOT persisted (no history spam); failures are audited.
 */
export async function POST(req: NextRequest) {
  const token = getSessionToken(req);
  const claims = token ? await verifySession(token) : null;
  if (!claims) return NextResponse.json({ error: "Invalid or expired session", code: "session_invalid" }, { status: 401 });
  if (!(await isUserSessionActive(claims.sid))) return NextResponse.json({ error: "Session revoked", code: "session_revoked" }, { status: 401 });
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

  const preset = parsed.data.preset;
  const file = CANONICAL_PROFILES[preset];
  if (!file) {
    return NextResponse.json({ error: "Could not build profile", code: "build_failed" }, { status: 500 });
  }
  const check = validateMobileconfig(file.xml, preset);
  return NextResponse.json({
    ok: check.ok,
    errors: check.errors,
    schemaVersion: MOBILECONFIG_SCHEMA_VERSION,
    identifier: file.identifier,
    uuid: file.uuid,
  });
}
