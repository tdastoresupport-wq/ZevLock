import { NextRequest, NextResponse } from "next/server";
import {
  addLog, countDevices, createSession, findDevice, findLicenseByKey,
  getFunctions, setFunctions, updateLicense, upsertDevice,
} from "@/lib/db";
import { effectiveLicense } from "@/lib/license";
import { rateLimit, signSession, tooMany } from "@/lib/auth";
import { activateLicenseSchema } from "@/lib/validation";
import { addDaysIso, newId } from "@/lib/keys";

const SESSION_TTL_SECONDS = 30 * 24 * 3600; // 30-day secure session

/** POST /api/license/activate — verify key, bind device, create session. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "anon";
  if (!rateLimit(`activate:${ip}`, 10, 60_000)) return tooMany();

  const body = await req.json().catch(() => ({}));
  const parsed = activateLicenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", code: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { key, device_identifier, platform } = parsed.data;

  const lic = await findLicenseByKey(key);
  if (!lic) return NextResponse.json({ error: "License key not found", code: "not_found" }, { status: 404 });
  const eff = await effectiveLicense(lic);

  if (eff.status === "SUSPENDED") return NextResponse.json({ error: "License is suspended", code: "suspended" }, { status: 403 });
  if (eff.status === "REVOKED") return NextResponse.json({ error: "License has been revoked", code: "revoked" }, { status: 403 });
  if (eff.status === "EXPIRED") {
    return NextResponse.json({ error: "License has expired", code: "expired", expires_at: eff.expires_at }, { status: 403 });
  }

  // Device binding (privacy-conscious: opaque client-generated identifier).
  let device = await findDevice(eff.id, device_identifier);
  if (!device) {
    const bound = await countDevices(eff.id);
    if (bound >= eff.device_limit) {
      return NextResponse.json({ error: "Device limit reached for this license", code: "device_limit_reached" }, { status: 403 });
    }
    const ts = new Date().toISOString();
    device = {
      id: newId("dev"), license_id: eff.id, device_identifier,
      platform, created_at: ts, last_seen_at: ts,
    };
    await upsertDevice(device);
  } else {
    await upsertDevice({ ...device, platform, last_seen_at: new Date().toISOString() });
  }

  // First activation transitions UNUSED -> ACTIVE.
  let expiresAt = eff.expires_at;
  if (eff.status === "UNUSED") {
    const days = Number(process.env.DEFAULT_DURATION_DAYS ?? 30);
    expiresAt = addDaysIso(new Date(), Number.isFinite(days) ? days : 30);
    await updateLicense(eff.id, { status: "ACTIVE", activated_at: new Date().toISOString(), expires_at: expiresAt });
    await addLog("license.activated", eff.id, device.id, { plan: eff.plan });
  }

  // Ensure a function-state row exists, then open a session.
  await setFunctions(eff.id, device.id, {});
  await getFunctions(eff.id);
  const sid = newId("sess");
  const sessionExp = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await createSession({ id: sid, license_id: eff.id, device_id: device.id, expires_at: sessionExp });
  await addLog("session.created", eff.id, device.id, { platform });

  const token = await signSession(sid, eff.id, SESSION_TTL_SECONDS);
  const res = NextResponse.json({ token, expires_at: sessionExp, plan: eff.plan });
  res.cookies.set("zev_session", token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
