import { NextRequest, NextResponse } from "next/server";
import { addLog, listPresetStates, profileStats, setPresetEnabled } from "@/lib/db";
import { adminOnly, getAdmin, rateLimit, tooMany } from "@/lib/auth";
import { MOBILECONFIG_SCHEMA_VERSION, PRESET_MARKETING } from "@/lib/mobileconfig";
import { z } from "zod";

/** GET /api/admin/mobileconfig/templates — presets, schema version, stats. */
export async function GET(req: NextRequest) {
  const denied = await adminOnly(req);
  if (denied) return denied;
  const [states, stats] = await Promise.all([listPresetStates(), profileStats()]);
  return NextResponse.json({
    schemaVersion: MOBILECONFIG_SCHEMA_VERSION,
    presets: states.map((s) => ({
      ...s,
      label: PRESET_MARKETING[s.preset as keyof typeof PRESET_MARKETING]?.title ?? s.preset,
      stats: stats.find((x) => x.preset === s.preset) ?? { created: 0, downloaded: 0 },
    })),
  });
}

const toggleSchema = z
  .object({ preset: z.enum(["legacy", "standard", "high-hz"]), enabled: z.boolean() })
  .strict();

/** POST /api/admin/mobileconfig/templates — enable/disable a preset (ADMIN+). */
export async function POST(req: NextRequest) {
  const denied = await adminOnly(req, "ADMIN");
  if (denied) return denied;
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "anon";
  if (!rateLimit(`admin-mutate:${ip}`, 30, 60_000)) return tooMany();

  const body = await req.json().catch(() => ({}));
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", code: "invalid_request" }, { status: 400 });
  }
  await setPresetEnabled(parsed.data.preset, parsed.data.enabled);
  const admin = await getAdmin(req);
  await addLog("admin.preset_toggled", null, null, {
    preset: parsed.data.preset,
    enabled: parsed.data.enabled,
    by: admin?.email ?? "unknown",
  });
  return NextResponse.json({ presets: await listPresetStates() });
}
