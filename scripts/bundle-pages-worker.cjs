// Build helper (local tooling only): assemble the Cloudflare Pages deployment
// from the OpenNext output and bundle it into a single _worker.js.
//
// Pipeline (run via `npm run cf:pages`, which runs cf:build first):
//   1. copy .open-next/assets/* -> .pages/            (static files)
//   2. esbuild scripts/pages-entry.mjs -> .pages2/_worker.js
//      (entry wraps the OpenNext worker: static via ASSETS binding first,
//      plus a real global require banner — Pages' bundler turns CJS
//      require() of node builtins into a throwing shim without it)
//   3. copy .pages2/_worker.js -> .pages/_worker.js   (single worker file)
// Then deploy manually: `npx wrangler pages deploy .pages --project-name zev-lock --branch main`
const esbuild = require("esbuild");
const { builtinModules } = require("module");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OPEN_NEXT = path.join(ROOT, ".open-next");
const PAGES = path.join(ROOT, ".pages");
const PAGES2 = path.join(ROOT, ".pages2");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

async function main() {
  if (!fs.existsSync(path.join(OPEN_NEXT, "worker.js"))) {
    throw new Error("missing .open-next/worker.js — run `npm run cf:build` first");
  }
  fs.rmSync(PAGES, { recursive: true, force: true });
  fs.rmSync(PAGES2, { recursive: true, force: true });
  copyDir(path.join(OPEN_NEXT, "assets"), PAGES);
  await esbuild.build({
    entryPoints: [path.join(ROOT, "scripts", "pages-entry.mjs")],
    bundle: true,
    format: "esm",
    platform: "neutral",
    external: [...builtinModules, ...builtinModules.map((m) => `node:${m}`), "cloudflare:*"],
    banner: {
      js: 'import { createRequire as __zevCr } from "node:module"; globalThis.require ??= __zevCr("/_worker.js");',
    },
    outfile: path.join(PAGES2, "_worker.js"),
    allowOverwrite: true,
    logLevel: "warning",
  });
  fs.copyFileSync(path.join(PAGES2, "_worker.js"), path.join(PAGES, "_worker.js"));
  console.log("PAGES bundle ready in .pages/ (assets + _worker.js)");
}

main().catch((e) => { console.error("PAGES-BUILD-FAIL", e.message); process.exit(1); });
