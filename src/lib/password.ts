import bcrypt from "bcryptjs";

/** Password hashing (bcrypt, pure JS — runs on Node and Cloudflare Workers). */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    if (!password || !hash) return false;
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
