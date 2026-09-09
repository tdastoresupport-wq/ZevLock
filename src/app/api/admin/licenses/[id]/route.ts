import { NextRequest, NextResponse } from "next/server";
import { addLog, countDevices, deleteLicense, findLicenseById, updateLicense } from "@/lib/db";
import { effectiveLicense } from "@/lib/license";
import { adminOnly, rateLimit, tooMany, getClientIp} from "@/lib/auth";
import { editLicenseSchema } from "@/lib/validation";
import { validateAvatar } from "@/lib/avatar";

/** GET /api/admin/licenses/:id — VIEW LICENSE detail. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminOnly(req);
  if (denied) return denied;
  const lic = await findLicenseById((await params).id);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });
  const eff = await effectiveLicense(lic);
  return NextResponse.json({ license: eff, bound_devices: await countDevices(eff.id) });
}

/** DELETE /api/admin/licenses/:id — archive/delete a license. Requires ADMIN+. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminOnly(req, "ADMIN");
  if (denied) return denied;
  const ip = getClientIp(req);
  if (!rateLimit(`admin-mutate:${ip}`, 30, 60_000)) return tooMany();
  const id = (await params).id;
  const lic = await findLicenseById(id);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });
  await deleteLicense(id);
  // Log the id only — never the reusable key value.
  await addLog("license.deleted", null, null, { license_id: id });
  return NextResponse.json({ ok: true });
}

/** PATCH /api/admin/licenses/:id — edit presentation + limits. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminOnly(req);
  if (denied) return denied;
  const ip = getClientIp(req);
  if (!rateLimit(`admin-mutate:${ip}`, 30, 60_000)) return tooMany();
  const id = (await params).id;
  const lic = await findLicenseById(id);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = editLicenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", code: "invalid_request" }, { status: 400 });
  }
  const { display_name, avatar, notes, plan, device_limit, expires_at } = parsed.data;
  if (avatar !== undefined) {
    const check = validateAvatar(avatar);
    if (!check.ok) return NextResponse.json({ error: check.error, code: "invalid_avatar" }, { status: 400 });
  }
  if (expires_at !== undefined && expires_at !== null && Number.isNaN(Date.parse(expires_at))) {
    return NextResponse.json({ error: "expires_at must be a valid date", code: "invalid_request" }, { status: 400 });
  }
  const patch: Record<string, string | number | null> = {};
  if (display_name !== undefined) patch.display_name = display_name;
  if (avatar !== undefined) patch.avatar = avatar;
  if (notes !== undefined) patch.notes = notes;
  if (plan !== undefined) patch.plan = plan;
  if (device_limit !== undefined) patch.device_limit = device_limit;
  if (expires_at !== undefined) patch.expires_at = expires_at;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update", code: "invalid_request" }, { status: 400 });
  }
  await updateLicense(id, patch);
  await addLog("license.updated", id, null, { fields: Object.keys(patch) });
  return NextResponse.json({ license: await findLicenseById(id) });
}
