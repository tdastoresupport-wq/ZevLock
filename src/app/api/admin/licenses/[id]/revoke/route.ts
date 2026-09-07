import { NextRequest, NextResponse } from "next/server";
import { addLog, findLicenseById, revokeSessionsForLicense, updateLicense } from "@/lib/db";
import { adminOnly } from "@/lib/auth";

/** POST /api/admin/licenses/:id/revoke — REVOKE (permanent, sessions revoked). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminOnly(req);
  if (denied) return denied;
  const lic = await findLicenseById((await params).id);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });
  await updateLicense(lic.id, { status: "REVOKED" });
  await revokeSessionsForLicense(lic.id);
  await addLog("license.revoked", lic.id, null, {});
  return NextResponse.json({ license: await findLicenseById(lic.id) });
}
