import { NextRequest, NextResponse } from "next/server";
import { adminStats, listDevices, listLogs } from "@/lib/db";
import { adminOnly } from "@/lib/auth";

/** GET /api/admin/devices */
export async function GET(req: NextRequest) {
  const denied = adminOnly(req);
  if (denied) return denied;
  const q = req.nextUrl.searchParams;
  const page = Math.max(1, Number(q.get("page") ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.get("limit") ?? 20) || 20));
  const items = await listDevices(limit, (page - 1) * limit);
  return NextResponse.json({ items, page, limit });
}
