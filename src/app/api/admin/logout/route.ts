import { NextResponse } from "next/server";

/** POST /api/admin/logout — clear the admin session cookie. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("zev_admin");
  return res;
}
