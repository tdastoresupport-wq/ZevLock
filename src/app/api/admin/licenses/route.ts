import { NextRequest, NextResponse } from "next/server";
import { addLog, insertLicense, listLicenses } from "@/lib/db";
import { adminOnly } from "@/lib/auth";
import { createLicenseSchema } from "@/lib/validation";
import { addDaysIso, generateLicenseKey, newId } from "@/lib/keys";

/** GET /api/admin/licenses — search/filter/paginate. */
export async function GET(req: NextRequest) {
  const denied = adminOnly(req);
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

/** POST /api/admin/licenses — CREATE LICENSE { plan, duration_days, device_limit }. */
export async function POST(req: NextRequest) {
  const denied = adminOnly(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const parsed = createLicenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", code: "invalid_request" }, { status: 400 });
  }
  const { plan, duration_days, device_limit } = parsed.data;
  const createdAt = new Date().toISOString();
  const lic = {
    id: newId("lic"),
    key: generateLicenseKey(),
    plan,
    status: "UNUSED" as const,
    device_limit,
    created_at: createdAt,
    activated_at: null as string | null,
    expires_at: addDaysIso(new Date(), duration_days),
  };
  await insertLicense(lic);
  await addLog("license.created", lic.id, null, { plan, duration_days, device_limit });
  return NextResponse.json({ license: lic }, { status: 201 });
}
