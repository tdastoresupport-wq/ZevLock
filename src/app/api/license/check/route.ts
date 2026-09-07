import { NextRequest, NextResponse } from "next/server";
import { findLicenseByKey } from "@/lib/db";
import { effectiveLicense } from "@/lib/license";
import { rateLimit, tooMany } from "@/lib/auth";
import { checkLicenseSchema } from "@/lib/validation";

/** POST /api/license/check — public, rate-limited. Returns minimal status info. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "anon";
  if (!rateLimit(`check:${ip}`, 20, 60_000)) return tooMany();

  const body = await req.json().catch(() => ({}));
  const parsed = checkLicenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid license key format", code: "invalid_format" }, { status: 400 });
  }

  const lic = await findLicenseByKey(parsed.data.key);
  if (!lic) {
    return NextResponse.json({ error: "License key not found", code: "not_found" }, { status: 404 });
  }
  const eff = await effectiveLicense(lic);
  return NextResponse.json({ status: eff.status, plan: eff.plan, expires_at: eff.expires_at });
}
