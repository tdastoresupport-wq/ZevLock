import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Monorepo-adjacent parent lockfile exists; pin tracing to this project.
  outputFileTracingRoot: __dirname,
  // Cloudflare Workers build is handled by @opennextjs/cloudflare (`npm run cf:build`).
};

export default nextConfig;
