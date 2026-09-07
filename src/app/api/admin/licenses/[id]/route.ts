import { NextRequest, NextResponse } from "next/server";
import { addLog, countDevices, deleteLicense, findLicenseById } from "@/lib/db";
import { effectiveLicense } from "@/lib/license";
import { adminOnly } from "@/lib/auth";

/** GET /api/admin/licenses/:id — VIEW LICENSE detail. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminOnly(req);
  if (denied) return denied;
  const lic = await findLicenseById((await params).id);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });
  const eff = await effectiveLicense(lic);
  return NextResponse.json({ license: eff, bound_devices: await countDevices(eff.id) });
}

/** DELETE /api/admin/licenses/:id — archive/delete a license. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminOnly(req);
  if (denied) return denied;
  const id = (await params).id;
  const lic = await findLicenseById(id);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });
  await deleteLicense(id);
  await addLog("license.deleted", null, null, { key: lic.key });
  return NextResponse.json({ ok: true });
}
