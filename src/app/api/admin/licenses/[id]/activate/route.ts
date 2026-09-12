import { NextRequest, NextResponse } from "next/server";
import { addLog, findLicenseById, updateLicense } from "@/lib/db";
import { adminOnly } from "@/lib/auth";
import { changeDeviceLimitSchema, changePlanSchema, extendLicenseSchema } from "@/lib/validation";
import { addDaysIso } from "@/lib/keys";

/** POST /api/admin/licenses/:id/activate — ACTIVATE an UNUSED/SUSPENDED/EXPIRED key. ADMIN+ only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminOnly(req, "ADMIN");
  if (denied) return denied;
  const lic = await findLicenseById((await params).id);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });
  if (lic.status === "REVOKED") {
    return NextResponse.json({ error: "Revoked licenses cannot be reactivated", code: "revoked" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { duration_days?: unknown };
  const parsed = extendLicenseSchema.safeParse(body.duration_days ? { extra_days: body.duration_days } : {});
  const days = parsed.success ? parsed.data.extra_days : 30;
  const needsExpiry = lic.is_permanent !== 1 && (!lic.expires_at || new Date(lic.expires_at).getTime() < Date.now());
  const patch: { status: "ACTIVE"; activated_at?: string; expires_at?: string } = { status: "ACTIVE" };
  if (lic.status === "UNUSED" || needsExpiry) {
    patch.activated_at = lic.activated_at ?? new Date().toISOString();
    if (lic.is_permanent !== 1) patch.expires_at = addDaysIso(new Date(), days);
  }
  await updateLicense(lic.id, patch);
  await addLog("license.activated", lic.id, null, { by: "admin" });
  return NextResponse.json({ license: await findLicenseById(lic.id) });
}

/** PATCH handlers for plan / device-limit live under the same file? No — separate routes. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminOnly(req, "ADMIN");
  if (denied) return denied;
  const lic = await findLicenseById((await params).id);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  const plan = changePlanSchema.safeParse(body);
  if (plan.success) {
    await updateLicense(lic.id, { plan: plan.data.plan });
    await addLog("license.plan_changed", lic.id, null, { plan: plan.data.plan });
    return NextResponse.json({ license: await findLicenseById(lic.id) });
  }
  const limit = changeDeviceLimitSchema.safeParse(body);
  if (limit.success) {
    await updateLicense(lic.id, { device_limit: limit.data.device_limit });
    await addLog("license.limit_changed", lic.id, null, { device_limit: limit.data.device_limit });
    return NextResponse.json({ license: await findLicenseById(lic.id) });
  }
  return NextResponse.json({ error: "Provide { plan } or { device_limit }", code: "invalid_request" }, { status: 400 });
}
