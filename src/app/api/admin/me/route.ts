import { NextRequest, NextResponse } from "next/server";
import { getAdmin, unauthorized } from "@/lib/auth";

/** GET /api/admin/me — current admin session. */
export async function GET(req: NextRequest) {
  const admin = await getAdmin(req);
  if (!admin) return unauthorized("admin_required");
  return NextResponse.json({ admin });
}
