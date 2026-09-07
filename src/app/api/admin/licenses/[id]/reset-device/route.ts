import { NextRequest, NextResponse } from "next/server";
import { addLog, deleteDevicesForLicense, findLicenseById, revokeSessionsForLicense } from "@/lib/db";
import { adminOnly } from "@/lib/auth";

/** POST /api/admin/licenses/:id/reset-device — RESET DEVICE binding. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminOnly(req);
  if (denied) return denied;
  const lic = await findLicenseById((await params).id);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });
  await deleteDevicesForLicense(lic.id);
  await revokeSessionsForLicense(lic.id);
  await addLog("device.reset", lic.id, null, { by: "admin" });
  return NextResponse.json({ ok: true });
}
