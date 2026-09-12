// Pages entry wrapper (bundled by scripts/bundle-pages-worker.cjs).
// Cloudflare Pages sends every request to _worker.js; static files deployed
// alongside it are reachable through the platform ASSETS binding. Serve those
// directly (correct content-type + edge caching); everything else falls
// through to the OpenNext handler.
import opennextWorker from "../.open-next/worker.js";

const pagesWorker = {
  async fetch(request, env, ctx) {
    if (env && env.ASSETS && (request.method === "GET" || request.method === "HEAD")) {
      try {
        const res = await env.ASSETS.fetch(request);
        if (res && res.status !== 404) return res;
      } catch {
        /* fall through to the app */
      }
    }
    return opennextWorker.fetch(request, env, ctx);
  },
};

export default pagesWorker;
