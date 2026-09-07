import { NextRequest, NextResponse } from "next/server";
import { addLog, findLicenseById, updateLicense } from "@/lib/db";
import { adminOnly } from "@/lib/auth";
import { extendLicenseSchema } from "@/lib/validation";
import { addDaysIso } from "@/lib/keys";

/** POST /api/admin/licenses/:id/extend — EXTEND EXPIRY { extra_days }. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminOnly(req);
  if (denied) return denied;
  const lic = await findLicenseById((await params).id);
  if (!lic) return NextResponse.json({ error: "License not found", code: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = extendLicenseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", code: "invalid_request" }, { status: 400 });

  const base = lic.expires_at && new Date(lic.expires_at).getTime() > Date.now() ? new Date(lic.expires_at) : new Date();
  const expires_at = addDaysIso(base, parsed.data.extra_days);
  // Extending a suspended/expired key also reactivates it.
  const status = lic.status === "ACTIVE" || lic.status === "UNUSED" ? lic.status : "ACTIVE";
  await updateLicense(lic.id, { expires_at, status });
  await addLog("license.extended", lic.id, null, { extra_days: parsed.data.extra_days });
  const updated = await findLicenseById(lic.id);
  return NextResponse.json({ license: updated });
}
