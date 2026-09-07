import { NextRequest, NextResponse } from "next/server";
import { adminStats } from "@/lib/db";
import { adminOnly } from "@/lib/auth";

/** GET /api/admin/stats */
export async function GET(req: NextRequest) {
  const denied = adminOnly(req);
  if (denied) return denied;
  return NextResponse.json(await adminStats());
}
