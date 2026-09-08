import { NextRequest, NextResponse } from "next/server";
import { addLog, countAdmins, createAdmin, findAdminByEmail, updateAdminLogin } from "@/lib/db";
import { rateLimit, safeEqual, signAdminToken, tooMany } from "@/lib/auth";
import { adminLoginSchema } from "@/lib/validation";
import { hashPassword, verifyPassword } from "@/lib/password";
import { newId } from "@/lib/keys";

/**
 * POST /api/admin/login — email + password.
 * First run: if no admin exists and the request matches ADMIN_EMAIL /
 * ADMIN_PASSWORD from the environment, a SUPER_ADMIN is provisioned
 * (bcrypt-hashed) automatically. Credentials are never logged.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "anon";
  if (!rateLimit(`admin-login:${ip}`, 5, 60_000)) return tooMany();

  const body = await req.json().catch(() => ({}));
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password", code: "invalid_credentials" }, { status: 401 });
  }
  const { email, password } = parsed.data;

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

  if (!admin || admin.status !== "ACTIVE" || !(await verifyPassword(password, admin.password_hash))) {
    await addLog("admin.login_failed", null, null, { email });
    // Generic message — do not reveal whether the email exists.
    return NextResponse.json({ error: "Invalid email or password", code: "invalid_credentials" }, { status: 401 });
  }

  await updateAdminLogin(admin.id);
  await addLog("admin.login", null, null, { email: admin.email, role: admin.role });
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
