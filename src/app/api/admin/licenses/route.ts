import { NextRequest, NextResponse } from "next/server";
import { addLog, insertLicense, listLicenses } from "@/lib/db";
import { adminOnly } from "@/lib/auth";
import { createLicenseSchema } from "@/lib/validation";
import { validateAvatar } from "@/lib/avatar";
import { addDaysIso, generateLicenseKey, newId } from "@/lib/keys";

/** GET /api/admin/licenses — search/filter/paginate. */
export async function GET(req: NextRequest) {
  const denied = await adminOnly(req);
  if (denied) return denied;
  const q = req.nextUrl.searchParams;
  const page = Math.max(1, Number(q.get("page") ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.get("limit") ?? 20) || 20));
  const { items, total } = await listLicenses({
    search: q.get("search")?.toUpperCase() || undefined,
    status: q.get("status") || undefined,
    plan: q.get("plan") || undefined,
    limit,
    offset: (page - 1) * limit,
  });
  return NextResponse.json({ items, total, page, limit });
}

const PRESET_MS: Record<string, number> = {
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
};

/**
 * POST /api/admin/licenses — CREATE LICENSE.
 * { plan, duration_preset: hour|day|week|month|custom|permanent,
 *   custom_days?, duration_days? (legacy), device_limit,
 *   display_name?, avatar?, notes? }
 * Keys use cryptographically secure randomness (see lib/keys).
 */
export async function POST(req: NextRequest) {
  const denied = await adminOnly(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const parsed = createLicenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", code: "invalid_request" }, { status: 400 });
  }
  const { plan, duration_preset, custom_days, duration_days, device_limit, display_name, notes } = parsed.data;
  const avatar = parsed.data.avatar ?? null;
  const avatarCheck = validateAvatar(avatar);
  if (!avatarCheck.ok) {
    return NextResponse.json({ error: avatarCheck.error, code: "invalid_avatar" }, { status: 400 });
  }

  let expires_at: string | null;
  if (duration_preset === "permanent") {
    expires_at = null;
  } else if (duration_preset === "custom") {
    if (!custom_days) {
      return NextResponse.json({ error: "custom_days is required for custom duration", code: "invalid_request" }, { status: 400 });
    }
    expires_at = addDaysIso(new Date(), custom_days);
  } else if (duration_days) {
    expires_at = addDaysIso(new Date(), duration_days);
  } else {
    expires_at = new Date(Date.now() + PRESET_MS[duration_preset]).toISOString();
  }

  const createdAt = new Date().toISOString();
  const lic = {
    id: newId("lic"),
    key: generateLicenseKey(),
    plan,
    status: "UNUSED" as const,
    device_limit,
    created_at: createdAt,
    activated_at: null as string | null,
    expires_at,
    display_name: display_name ?? null,
    avatar,
    notes: notes ?? null,
    last_used_at: null as string | null,
  };
  await insertLicense(lic);
  await addLog("license.created", lic.id, null, { plan, duration_preset, device_limit });
  return NextResponse.json({ license: lic }, { status: 201 });
}
