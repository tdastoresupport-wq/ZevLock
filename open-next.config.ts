// OpenNext Cloudflare adapter config (required by `npm run cf:build`).
// Minimal: the app is fully dynamic (no ISR/fetch-cache), so no R2 bucket,
// image binding, or self-reference service is needed.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
