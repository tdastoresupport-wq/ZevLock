import { NextRequest, NextResponse } from "next/server";
import {
  addLog, countAdmins, createAdmin, createAdminSession, findAdminByEmail, updateAdminLogin,
} from "@/lib/db";
import { getClientIp, rateLimit, safeEqual, signAdminToken, tooMany } from "@/lib/auth";
import { adminLoginSchema } from "@/lib/validation";
import { hashPassword, verifyPassword } from "@/lib/password";
import { newId } from "@/lib/keys";

/**
 * Dummy bcrypt hash (of a published never-used password) so unknown emails
 * cost the same as real verifications — closes the login timing oracle.
 * This hash is public by design; it grants nothing.
 */
const DUMMY_HASH = "$2b$10$DgKPj6ockjXxIIFbwAxhWuBpoG4MUpPxMzf/Cx1OSCuK1yLw0OBSm";

/**
 * POST /api/admin/login — email + password.
 * First run: if no admin exists and the request matches ADMIN_EMAIL /
 * ADMIN_PASSWORD from the environment, a SUPER_ADMIN is provisioned
 * (bcrypt-hashed) automatically. Credentials are never logged.
 * Throttled per IP AND per email (distributed spray resistance).
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const body = await req.json().catch(() => ({}));
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password", code: "invalid_credentials" }, { status: 401 });
  }
  const { email, password } = parsed.data;

  if (!rateLimit(`admin-login:ip:${ip}`, 20, 60_000) || !rateLimit(`admin-login:email:${email}`, 5, 60_000)) {
    await addLog("rate_limited", null, null, { endpoint: "admin.login" });
    return tooMany();
  }

  let admin = await findAdminByEmail(email);

  if (!admin && (await countAdmins()) === 0) {
    const envEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
    const envPassword = process.env.ADMIN_PASSWORD ?? "";
    if (envEmail && envPassword && email === envEmail && safeEqual(password, envPassword)) {
      const created = {
        id: newId("adm"),
        email,
        name: "Owner",
        role: "SUPER_ADMIN" as const,
        status: "ACTIVE" as const,
        created_at: new Date().toISOString(),
        last_login_at: null as string | null,
        password_hash: await hashPassword(envPassword),
      };
      await createAdmin(created);
      await addLog("admin.bootstrapped", null, null, { email });
      admin = created;
    }
  }

  // Always verify a hash: real one, or the dummy — same cost, same message.
  const hash = admin && admin.status === "ACTIVE" ? admin.password_hash : DUMMY_HASH;
  const ok = await verifyPassword(password, hash);
  if (!admin || admin.status !== "ACTIVE" || !ok) {
    await addLog("admin.login_failed", null, null, { email });
    // Generic message — do not reveal whether the email exists.
    return NextResponse.json({ error: "Invalid email or password", code: "invalid_credentials" }, { status: 401 });
  }

  await updateAdminLogin(admin.id);
  await addLog("admin.login", null, null, { email: admin.email, role: admin.role });
  // Single revocable admin session per admin (new login supersedes the old).
  await createAdminSession({
    id: `admin:${admin.id}`,
    admin_id: admin.id,
    expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
  });
  const token = await signAdminToken({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
  const res = NextResponse.json({
    token,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
  });
  res.cookies.set("zev_admin", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 3600,
  });
  return res;
}
