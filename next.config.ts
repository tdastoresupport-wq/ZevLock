import type { NextConfig } from "next";

/**
 * Security headers (F-HDR-01). Deliberate choices:
 * - No X-Frame-Options: DENY (would be blind); SAMEORIGIN via frame-ancestors.
 * - unsafe-inline for scripts/styles: required by Next.js runtime chunks.
 * - No HSTS includeSubDomains/preload: avoids bricking sibling http hosts;
 *   Cloudflare should enforce edge TLS (see README Cloudflare section).
 * - MobileConfig downloads + PWA unaffected (same-origin blobs, no frames).
 *
 * Root-cause note (startup hang): `next dev` executes the React Refresh
 * runtime through eval(), so the dev server MUST allow 'unsafe-eval' or the
 * client bundle dies with an EvalError and the splash never clears.
 * Production builds contain no eval, so prod stays strict.
 */
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      // img https: allowed for admin-configured remote avatars (rendered in
      // <img> only — no script execution context).
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Monorepo-adjacent parent lockfile exists; pin tracing to this project.
  outputFileTracingRoot: __dirname,
  // Cloudflare Workers build is handled by @opennextjs/cloudflare (`npm run cf:build`).
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
