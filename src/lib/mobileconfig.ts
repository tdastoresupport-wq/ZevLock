/**
 * MobileConfig generator for Zev Lock (iOS configuration profiles).
 *
 * SCHEMA ASSUMPTIONS (no network retrieval available in this environment, so
 * only long-documented Apple keys are used — nothing invented):
 * - Top-level "Configuration" payload keys used: PayloadContent, PayloadDescription,
 *   PayloadDisplayName, PayloadIdentifier, PayloadOrganization,
 *   PayloadRemovalDisallowed, DurationUntilRemoval, PayloadType, PayloadUUID,
 *   PayloadVersion. All are part of Apple's documented profile schema.
 * - Single nested payload: "com.apple.webClip.managed" (Web Clip) with keys
 *   FullScreen, IsRemovable, Label, PayloadDescription, PayloadDisplayName,
 *   PayloadIdentifier, PayloadType, PayloadUUID, PayloadVersion, URL.
 * - Deliberately NOT included: any com.apple.accessibility keys (no reliable
 *   documented key list available here — inventing them would violate the
 *   no-undocumented-keys rule), Icon blob, ConsentText, PayloadScope.
 * - The three presets (Legacy / Standard / High-Hz) differ ONLY in documented
 *   settings: description text, auto-removal duration, and the Web Clip label.
 *   They install a Home-Screen shortcut. They do not change system settings
 *   and provide no aim, recoil, targeting, or gameplay effects of any kind.
 */

export const PROFILE_PRESETS = ["legacy", "standard", "high-hz"] as const;
export type ProfilePreset = (typeof PROFILE_PRESETS)[number];

export const PROFILE_APP_NAME = "Zev Lock";
export const PROFILE_ORG = "Duc Anh Zev - Đức Anh Zev Trùm File";
export const PROFILE_CONTENT_TYPE = "application/x-apple-aspen-config";

/** Version of the Zev profile schema (preset definitions + builder output). */
export const MOBILECONFIG_SCHEMA_VERSION = "1.0.0";

interface PresetDef {
  preset: ProfilePreset;
  clipLabel: string;
  description: string;
  durationSeconds: number;
}

const PRESETS: Record<ProfilePreset, PresetDef> = {
  legacy: {
    preset: "legacy",
    clipLabel: "Zev Lock",
    description:
      "Zev Lock install profile (Legacy, 30 days). Adds the Zev Lock shortcut to your Home Screen. " +
      "Does not change system settings and has no gameplay effects. After downloading, install it in Settings.",
    durationSeconds: 30 * 86_400,
  },
  standard: {
    preset: "standard",
    clipLabel: "Zev Lock",
    description:
      "Zev Lock install profile (Standard, 1 year). Adds the Zev Lock shortcut to your Home Screen. " +
      "Does not change system settings and has no gameplay effects. After downloading, install it in Settings.",
    durationSeconds: 365 * 86_400,
  },
  "high-hz": {
    preset: "high-hz",
    clipLabel: "Zev Lock",
    description:
      "Zev Lock install profile (Promotion High-Hz, 7 days). Adds the Zev Lock shortcut to your Home Screen. " +
      "Does not change system settings and has no gameplay effects. After downloading, install it in Settings.",
    durationSeconds: 7 * 86_400,
  },
};

/**
 * Touch Accommodations honesty boundary.
 * There is no public iOS configuration-profile schema available here for
 * settings like Hold Duration / Ignore Repeat / Touch Accommodations toggles,
 * so they are marked unsupported-by-public-profile-schema: the profile XML
 * never claims to configure them, and the PWA presents them as MANUAL iOS
 * steps instead. (Rule: never invent Apple payload keys.)
 */
export interface UnsupportedSetting {
  name: string;
  manualPath: string;
  reason: string;
}

export const UNSUPPORTED_TOUCH_SETTINGS: UnsupportedSetting[] = [
  {
    name: "Touch Accommodations",
    manualPath: "Settings → Accessibility → Touch → Touch Accommodations",
    reason: "No public MobileConfig schema available — configure manually in iOS Accessibility.",
  },
  {
    name: "Hold Duration",
    manualPath: "Settings → Accessibility → Touch → Touch Accommodations → Hold Duration",
    reason: "No public MobileConfig schema available — configure manually in iOS Accessibility.",
  },
  {
    name: "Ignore Repeat",
    manualPath: "Settings → Accessibility → Touch → Touch Accommodations → Ignore Repeat",
    reason: "No public MobileConfig schema available — configure manually in iOS Accessibility.",
  },
];

/** Owner-provided marketing card content (PWA UI ONLY — never inside the plist). */
export interface PresetMarketing {
  preset: ProfilePreset;
  title: string;
  tagline: string;
  deviceSupport: string;
  price: string;
  tiktok: string;
  manualNote: string;
}

export const PRESET_MARKETING: Record<ProfilePreset, PresetMarketing> = {
  legacy: {
    preset: "legacy",
    title: "Legacy 60Hz",
    tagline: "App hỗ trợ cấu hình phản hồi cảm ứng của iPhone.",
    deviceSupport: "Legacy 60Hz",
    price: "50 000 VNĐ → 500 000 VNĐ",
    tiktok: "dvmxhontop",
    manualNote: "Some touch settings must be configured manually in iOS Accessibility.",
  },
  standard: {
    preset: "standard",
    title: "Standard OLED 60Hz",
    tagline: "App hỗ trợ cấu hình phản hồi cảm ứng của iPhone.",
    deviceSupport: "Standard OLED 60Hz",
    price: "50 000 VNĐ → 500 000 VNĐ",
    tiktok: "dvmxhontop",
    manualNote: "Some touch settings must be configured manually in iOS Accessibility.",
  },
  "high-hz": {
    preset: "high-hz",
    title: "Promotion High-Hz",
    tagline: "App hỗ trợ cấu hình phản hồi cảm ứng của iPhone.",
    deviceSupport: "Promotion High-Hz",
    price: "50 000 VNĐ → 500 000 VNĐ",
    tiktok: "dvmxhontop",
    manualNote: "Some touch settings must be configured manually in iOS Accessibility.",
  },
};

export interface GeneratedProfile {
  preset: ProfilePreset;
  payloadIdentifier: string;
  payloadUUID: string;
  webclipUUID: string;
  filename: string;
  xml: string;
}

/** Strict XML escaping for plist string content. */
export function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type PlistValue =
  | { t: "s"; v: string }
  | { t: "i"; v: number }
  | { t: "b"; v: boolean }
  | { t: "dict"; v: [string, PlistValue][] }
  | { t: "arr"; v: PlistValue[] };

function renderValue(v: PlistValue, indent: string): string {
  const pad = (s: string) => `${indent}${s}`;
  switch (v.t) {
    case "s":
      return pad(`<string>${escXml(v.v)}</string>`);
    case "i":
      if (!Number.isInteger(v.v)) throw new Error("plist integer must be an integer");
      return pad(`<integer>${v.v}</integer>`);
    case "b":
      return pad(v.v ? "<true/>" : "<false/>");
    case "arr":
      return [pad("<array>"), ...v.v.map((x) => renderValue(x, `${indent}\t`)), pad("</array>")].join("\n");
    case "dict": {
      const lines = [pad("<dict>")];
      for (const [k, val] of v.v) {
        lines.push(`${indent}\t<key>${escXml(k)}</key>`);
        lines.push(renderValue(val, `${indent}\t`));
      }
      lines.push(pad("</dict>"));
      return lines.join("\n");
    }
  }
}

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(s: string): boolean {
  return UUID_V4.test(s);
}

function newUuid(): string {
  return crypto.randomUUID(); // RFC 4122 v4
}

function buildUrl(origin: string, preset: ProfilePreset): string {
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    throw new Error("invalid origin for profile URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("invalid origin protocol");
  return `${u.origin}/?utm_source=ios-profile&utm_preset=${preset}`;
}

export function filenameFor(preset: string): string {
  if (!(PROFILE_PRESETS as readonly string[]).includes(preset)) {
    throw new Error("unknown profile preset");
  }
  return `zev-lock-${preset}.mobileconfig`;
}

export function buildMobileconfig(opts: {
  preset: ProfilePreset;
  origin: string;
  uuids?: { profile: string; webclip: string };
}): GeneratedProfile {
  const def = PRESETS[opts.preset];
  if (!def) throw new Error("unknown profile preset");
  const profileUUID = opts.uuids?.profile ?? newUuid();
  const webclipUUID = opts.uuids?.webclip ?? newUuid();
  if (!isUuidV4(profileUUID) || !isUuidV4(webclipUUID)) throw new Error("malformed UUID");
  const identifier = `com.zevlock.profile.${opts.preset}.${profileUUID}`;
  const url = buildUrl(opts.origin, opts.preset);

  const webclip: [string, PlistValue][] = [
    ["FullScreen", { t: "b", v: true }],
    ["IsRemovable", { t: "b", v: true }],
    ["Label", { t: "s", v: def.clipLabel }],
    ["PayloadDescription", { t: "s", v: def.description }],
    ["PayloadDisplayName", { t: "s", v: PROFILE_APP_NAME }],
    ["PayloadIdentifier", { t: "s", v: `${identifier}.webclip` }],
    ["PayloadType", { t: "s", v: "com.apple.webClip.managed" }],
    ["PayloadUUID", { t: "s", v: webclipUUID }],
    ["PayloadVersion", { t: "i", v: 1 }],
    ["URL", { t: "s", v: url }],
  ];

  // Fixed key order → deterministic serialization.
  const top: [string, PlistValue][] = [
    ["PayloadContent", { t: "arr", v: [{ t: "dict", v: webclip }] }],
    ["PayloadDescription", { t: "s", v: def.description }],
    ["PayloadDisplayName", { t: "s", v: PROFILE_APP_NAME }],
    ["PayloadIdentifier", { t: "s", v: identifier }],
    ["PayloadOrganization", { t: "s", v: PROFILE_ORG }],
    ["PayloadRemovalDisallowed", { t: "b", v: false }],
    ["DurationUntilRemoval", { t: "i", v: def.durationSeconds }],
    ["PayloadType", { t: "s", v: "Configuration" }],
    ["PayloadUUID", { t: "s", v: profileUUID }],
    ["PayloadVersion", { t: "i", v: 1 }],
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    renderValue({ t: "dict", v: top }, ""),
    "</plist>",
    "",
  ].join("\n");

  return {
    preset: opts.preset,
    payloadIdentifier: identifier,
    payloadUUID: profileUUID,
    webclipUUID,
    filename: filenameFor(opts.preset),
    xml,
  };
}

/** Lightweight XML well-formedness check (stack-based tag matcher). */
function xmlWellFormed(xml: string): string[] {
  const errors: string[] = [];
  const stripped = xml
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<![\s\S]*?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const re = /<\/?([A-Za-z][A-Za-z0-9]*)\b[^>]*?\/?>/g;
  const stack: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const full = m[0];
    const tag = m[1];
    if (full.endsWith("/>")) continue; // self-closing (<true/>, <false/>)
    if (full.startsWith("</")) {
      const open = stack.pop();
      if (open !== tag) errors.push(`mismatched tag: expected </${open ?? "?"}>, got </${tag}>`);
    } else {
      stack.push(tag);
    }
  }
  if (stack.length > 0) errors.push(`unclosed tags: ${stack.join(", ")}`);
  return errors;
}

const REQUIRED_TOP_KEYS = [
  "PayloadContent",
  "PayloadDescription",
  "PayloadDisplayName",
  "PayloadIdentifier",
  "PayloadOrganization",
  "PayloadRemovalDisallowed",
  "DurationUntilRemoval",
  "PayloadType",
  "PayloadUUID",
  "PayloadVersion",
];

/** Pre-download validation: structure, required keys, UUIDs, honesty markers. */
export function validateMobileconfig(xml: string, preset: ProfilePreset): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    errors.push("missing XML declaration");
  }
  if (!xml.includes('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"')) {
    errors.push("missing plist DOCTYPE");
  }
  if (xml.includes("...")) errors.push("profile contains ellipses");
  errors.push(...xmlWellFormed(xml));
  for (const k of REQUIRED_TOP_KEYS) {
    if (!xml.includes(`<key>${k}</key>`)) errors.push(`missing required key: ${k}`);
  }
  if (!xml.includes("<string>Configuration</string>")) errors.push("top PayloadType must be Configuration");
  if (!xml.includes("<string>com.apple.webClip.managed</string>")) errors.push("missing webClip payload");
  const uuids = [...xml.matchAll(/<key>PayloadUUID<\/key>\s*<string>([^<]+)<\/string>/g)].map((x) => x[1]);
  if (uuids.length < 2) errors.push("expected at least 2 PayloadUUIDs (profile + webclip)");
  for (const u of uuids) {
    if (!isUuidV4(u)) errors.push(`malformed UUID: ${u}`);
  }
  if (!xml.includes(`<string>${PROFILE_APP_NAME}</string>`)) errors.push("missing PayloadDisplayName value");
  if (!xml.includes(`<string>${escXml(PROFILE_ORG)}</string>`)) errors.push("missing PayloadOrganization value");
  if (!xml.includes(`utm_preset=${preset}`)) errors.push("webclip URL does not match preset");
  return { ok: errors.length === 0, errors };
}
