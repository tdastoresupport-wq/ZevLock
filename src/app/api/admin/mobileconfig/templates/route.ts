import { NextRequest, NextResponse } from "next/server";
import { addLog, listLogs, listPresetStates, profileStats, setPresetEnabled } from "@/lib/db";
import { adminOnly, getAdmin, rateLimit, tooMany, getClientIp} from "@/lib/auth";
import { MOBILECONFIG_SCHEMA_VERSION, PRESET_MARKETING } from "@/lib/mobileconfig";
import { CANONICAL_PROFILES } from "@/mobileconfig/profiles/bytes";
import { z } from "zod";

/** GET /api/admin/mobileconfig/templates — presets, metadata, stats, recent errors. */
export async function GET(req: NextRequest) {
  const denied = await adminOnly(req);
  if (denied) return denied;
  const [states, stats, logs] = await Promise.all([
    listPresetStates(),
    profileStats(),
    listLogs(50, 0),
  ]);
  const encoder = new TextEncoder();
  return NextResponse.json({
    schemaVersion: MOBILECONFIG_SCHEMA_VERSION,
    presets: states.map((s) => {
      const file = CANONICAL_PROFILES[s.preset];
      return {
        ...s,
        label: PRESET_MARKETING[s.preset as keyof typeof PRESET_MARKETING]?.title ?? s.preset,
        filename: file?.filename ?? null,
        identifier: file?.identifier ?? null,
        uuid: file?.uuid ?? null,
        sizeBytes: file ? encoder.encode(file.xml).length : 0,
        xml: file?.xml ?? null,
        stats: stats.find((x) => x.preset === s.preset) ?? { created: 0, downloaded: 0 },
      };
    }),
    recentErrors: logs
      .filter((l) => l.type === "profile.failed")
      .slice(0, 10)
      .map((l) => ({ license_id: l.license_id, metadata: l.metadata, created_at: l.created_at })),
  });
}

const toggleSchema = z
  .object({
    preset: z.enum(["legacy-60hz", "standard-oled-60hz", "promotion-high-hz"]),
    enabled: z.boolean(),
  })
  .strict();

/** POST /api/admin/mobileconfig/templates — enable/disable a preset (ADMIN+). */
export async function POST(req: NextRequest) {
  const denied = await adminOnly(req, "ADMIN");
  if (denied) return denied;
  const ip = getClientIp(req);
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
