/** Generate ZEV-XXXX-XXXX-XXXX keys (unambiguous alphabet, no 0/O/1/I).
 *  Uses Web Crypto only — safe in Node and Cloudflare Workers. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function group(): string {
  let s = "";
  const buf = new Uint32Array(4);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 4; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

export function generateLicenseKey(): string {
  return `ZEV-${group()}-${group()}-${group()}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function addDaysIso(base: Date, days: number): string {
  return new Date(base.getTime() + days * 86_400_000).toISOString();
}
