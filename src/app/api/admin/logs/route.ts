import { NextRequest, NextResponse } from "next/server";
import { listLogs } from "@/lib/db";
import { adminOnly } from "@/lib/auth";

/** GET /api/admin/logs */
export async function GET(req: NextRequest) {
  const denied = await adminOnly(req);
  if (denied) return denied;
  const q = req.nextUrl.searchParams;
  const page = Math.max(1, Number(q.get("page") ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.get("limit") ?? 50) || 50));
  const items = await listLogs(limit, (page - 1) * limit);
  return NextResponse.json({ items, page, limit });
}
