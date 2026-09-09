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
/** Displayed at ≤60px; bounds reject abuse while accepting real photos. */
const MIN_DIM = 32;
const MAX_DIM = 1024;

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

/**
 * Dimension extraction from raw bytes (no image library):
 * - PNG: IHDR chunk (width/height @ bytes 16–23)
 * - JPEG: first SOFn marker (length + dims)
 * - WebP: VP8/VP8L/VP8X headers
 * Returns null when dimensions cannot be determined (malformed) → reject.
 */
export function imageDimensions(mime: string, b: Uint8Array): { w: number; h: number } | null {
  try {
    if (mime === "png") {
      if (b.length < 33) return null;
      // Bytes 12–15 must be the IHDR chunk type.
      if (b[12] !== 0x49 || b[13] !== 0x48 || b[14] !== 0x44 || b[15] !== 0x52) return null;
      const w = (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19];
      const h = (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23];
      if (w <= 0 || h <= 0) return null;
      return { w, h };
    }
    if (mime === "jpeg") {
      let i = 2;
      while (i + 8 < b.length) {
        if (b[i] !== 0xff) return null;
        const marker = b[i + 1];
        if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          i += 2;
          continue;
        }
        const len = (b[i + 2] << 8) | b[i + 3];
        if (len < 2) return null;
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          const h = (b[i + 5] << 8) | b[i + 6];
          const w = (b[i + 7] << 8) | b[i + 8];
          if (w <= 0 || h <= 0) return null;
          return { w, h };
        }
        i += 2 + len;
      }
      return null;
    }
    if (mime === "webp") {
      const fourcc = b.length >= 16
        ? String.fromCharCode(b[12], b[13], b[14], b[15])
        : "";
      // Lossy VP8: frame tag @21, start code @23, 14-bit dims @26.
      if (fourcc === "VP8 ") {
        if (b.length < 30) return null;
        if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
        const w = b[26] | ((b[27] & 0x3f) << 8);
        const h = b[28] | ((b[29] & 0x3f) << 8);
        if (w <= 0 || h <= 0) return null;
        return { w, h };
      }
      // Lossless VP8L: signature 0x2f at data offset 0 (byte 20), packed 14-bit dims follow.
      if (fourcc === "VP8L") {
        if (b.length < 25) return null;
        if (b[20] !== 0x2f) return null;
        const b0 = b[21], b1 = b[22], b2 = b[23], b3 = b[24];
        const w = 1 + (((b1 & 0x3f) << 8) | b0);
        const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        if (w <= 0 || h <= 0) return null;
        return { w, h };
      }
      // Extended VP8X: canvas dims @24 (24-bit minus one).
      if (fourcc === "VP8X") {
        if (b.length < 30) return null;
        const w = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
        const h = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
        if (w <= 0 || h <= 0) return null;
        return { w, h };
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
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
  const dims = imageDimensions(m[1], bytes);
  if (!dims) return { ok: false, error: "Avatar image is malformed" };
  if (dims.w < MIN_DIM || dims.h < MIN_DIM || dims.w > MAX_DIM || dims.h > MAX_DIM) {
    return { ok: false, error: `Avatar dimensions must be between ${MIN_DIM} and ${MAX_DIM}px` };
  }
  return { ok: true };
}
