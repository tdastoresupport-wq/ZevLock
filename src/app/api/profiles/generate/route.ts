import { NextRequest, NextResponse } from "next/server";
import { addLog, listProfileEvents } from "@/lib/db";
import { getSessionToken, rateLimit, tooMany, verifySession } from "@/lib/auth";
import { effectiveLicenseById } from "@/lib/license";
import { profilePresetSchema } from "@/lib/validation";
import {
  PROFILE_CONTENT_TYPE,
  buildMobileconfig,
  filenameFor,
  validateMobileconfig,
  type ProfilePreset,
} from "@/lib/mobileconfig";

/**
 * POST /api/profiles/generate — build a signed install profile for this license.
 * Requires a valid session + ACTIVE license (verified server-side, never trusted
 * from the browser). Rate-limited, audited. Returns the XML for client-side
 * validation + download (iOS installs it via Settings — never silently).
 */
export async function POST(req: NextRequest) {
  const token = getSessionToken(req);
  const claims = token ? await verifySession(token) : null;
  if (!claims) return NextResponse.json({ error: "Invalid or expired session", code: "session_invalid" }, { status: 401 });
  if (!rateLimit(`profile:${claims.licenseId}`, 10, 3_600_000)) return tooMany();

  const body = await req.json().catch(() => ({}));
  const parsed = profilePresetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown profile preset", code: "invalid_preset" }, { status: 400 });
  }
  const preset = parsed.data.preset as ProfilePreset;

  const lic = await effectiveLicenseById(claims.licenseId);
  if (!lic || lic.status !== "ACTIVE") {
    return NextResponse.json({ error: "License is not active", code: "license_inactive" }, { status: 403 });
  }

  const origin = req.nextUrl.origin;
  let profile;
  try {
    profile = buildMobileconfig({ preset, origin });
  } catch {
    return NextResponse.json({ error: "Could not build profile", code: "build_failed" }, { status: 500 });
  }
  const check = validateMobileconfig(profile.xml, preset);
  if (!check.ok) {
    return NextResponse.json({ error: "Generated profile failed validation", code: "invalid_profile" }, { status: 500 });
  }

  await addLog("profile.created", lic.id, null, {
    preset,
    identifier: profile.payloadIdentifier,
    uuid: profile.payloadUUID,
  });

  return NextResponse.json({
    preset,
    filename: filenameFor(preset),
    contentType: PROFILE_CONTENT_TYPE,
    identifier: profile.payloadIdentifier,
    uuid: profile.payloadUUID,
    xml: profile.xml,
    history: await listProfileEvents(lic.id, 20),
  });
}
