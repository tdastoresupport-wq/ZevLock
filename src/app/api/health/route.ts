import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * GET /api/health — unauthenticated liveness + dependency check for
 * monitoring/uptime probes. 200 only when the worker reaches D1; generic
 * 503 otherwise. Never exposes secrets, rows, or paths.
 */
export async function GET() {
  let ctx: ReturnType<typeof getCloudflareContext> | null = null;
  try {
    ctx = getCloudflareContext();
  } catch {
    ctx = null; // local `next dev` has no Cloudflare context
  }
  if (!ctx) return NextResponse.json({ ok: true, mode: "local" });
  try {
    const db = (ctx.env as Record<string, unknown>).DB as
      | { prepare: (q: string) => { first: <T>() => Promise<T | null> } }
      | undefined;
    if (!db) return NextResponse.json({ ok: false, code: "db_unbound" }, { status: 503 });
    await db.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return NextResponse.json({ ok: true, mode: "production" });
  } catch {
    return NextResponse.json({ ok: false, code: "db_unreachable" }, { status: 503 });
  }
}
