/**
 * Avatar value validation (server-side).
 * Accepted forms:
 * - "zev" ........................ official ZEV character preset
 * - "AB" ......................... 1–4 char initials (rendered, never executed)
 * - https://... .................. remote URL (length-capped, rendered via <img>)
 * - data:image/png|jpeg|webp ..... inline upload, base64, ≤96 KB, magic-byte checked
 * Uploaded bytes are stored as text and only ever rendered in <img> — never executed.
 */

const MAX_UPLOAD_BYTES = 96 * 1024;
const MAX_VALUE_LENGTH = 200_000;

function b64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function magicOk(mime: string, b: Uint8Array): boolean {
  if (mime === "png") {
    return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  }
  if (mime === "jpeg") {
    return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  }
  if (mime === "webp") {
    return (
      b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
    );
  }
  return false;
}

export function validateAvatar(value: string | null | undefined): { ok: boolean; error?: string } {
  if (value === null || value === undefined || value === "") return { ok: true };
  if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) {
    return { ok: false, error: "Avatar value too large" };
  }
  if (value === "zev") return { ok: true };
  if (/^[A-Za-z0-9 ]{1,4}$/.test(value)) return { ok: true };
  if (value.startsWith("https://") && value.length <= 500 && !/[\s<>"]/.test(value)) {
    return { ok: true };
  }
  const m = value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return { ok: false, error: "Unsupported avatar format (use PNG/JPEG/WebP, URL, initials, or the ZEV preset)" };
  const bytes = b64ToBytes(m[2]);
  if (!bytes || bytes.length > MAX_UPLOAD_BYTES || bytes.length < 16) {
    return { ok: false, error: "Avatar upload must be under 96 KB" };
  }
  if (!magicOk(m[1], bytes)) return { ok: false, error: "Avatar file content does not match its type" };
  return { ok: true };
}
