# Zev Lock

Mobile-first (iPhone-first) license platform — a premium dark PWA with a license-key-first flow,
virtual function toggles persisted to Cloudflare D1, and a full admin license-management dashboard.

**Scope honesty:** all "Function" toggles (AimLock Head, Stability Assist, …) are **simulated UI
state only**. They update frontend state, persist via the backend API to D1, and return updated
state. They never interact with games, processes, memory, files, jailbreak APIs, anti-cheat, or
any external system.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | Next.js 15, TypeScript (strict), Tailwind CSS 4, Framer Motion, Lucide Icons |
| Backend  | Next.js Route Handlers running on **Cloudflare Workers** via `@opennextjs/cloudflare` |
| Database | Cloudflare **D1** (SQLite), parameterized queries only |
| Validation | Zod schemas (`src/lib/validation.ts`) |
| Auth | License-key-first; HMAC-signed session tokens (HttpOnly cookie + Bearer fallback for iOS PWA); admin via `x-admin-token` |

## App structure

- `/` — License Key screen → 3-tab app (**Home · Function · Realtime**), iPhone safe-area aware
- `/admin` — Admin dashboard (**Overview · Licenses · Devices · Logs**)
- `/api/license/*`, `/api/device/*`, `/api/functions/*`, `/api/session/logout` — user API
- `/api/admin/*` — admin API (server-side authorized)

## Quick start (local dev)

```bash
npm install
cp .env.example .env.local   # dev-only defaults already work
npm run dev                  # http://localhost:3000
```

Local dev without a D1 binding uses an **in-memory demo store** seeded like
`migrations/0002_seed.sql` (demo key below). Production (Cloudflare) uses real D1.

**Demo credentials — DEVELOPMENT ONLY:**
- License: `ZEV-DEMO-2026-VIP1` (ACTIVE, expires 2031-03-16)
- Expired: `ZEV-EXP1-RED0-0001`
- Unused: `ZEV-NEW-USER-000001`
- Admin: any request with header `x-admin-token: <ADMIN_API_TOKEN>` (default `dev-only-admin-token-change-me`)

## D1 setup

```bash
npx wrangler d1 create zevlock-db
# paste database_id into wrangler.jsonc
npm run db:migrate:local    # verify migrations locally
npm run db:migrate:remote   # apply to production D1
npx wrangler d1 execute zevlock-db --remote --file=./migrations/0002_seed.sql  # optional demo seed
```

## Production deploy (Cloudflare Workers)

```bash
npx wrangler secret put SESSION_SECRET   # ≥32 random chars
npx wrangler secret put ADMIN_API_TOKEN  # strong random token
npm run cf:deploy
```

`wrangler.jsonc` already maps the D1 binding (`DB`), vars (`DEFAULT_DEVICE_LIMIT`,
`DEFAULT_PLAN`), and the OpenNext worker entry. Custom domain: add via Cloudflare dashboard
`Workers & Pages → zev-lock → Custom domains`.

## Project layout

```
migrations/          0001_init.sql (schema) · 0002_seed.sql (demo data)
src/app/             layout, globals.css, manifest, page (3-tab shell), admin/
src/app/api/         license · device · functions · session · admin routes
src/components/      AppShell, LicenseScreen, HomeTab, FunctionTab, RealtimeTab,
                     BottomNav, AdminDashboard, ui primitives
src/lib/             types, validation, db (D1 + dev fallback), auth (sessions,
                     admin gate, rate limit), license (expiry), keys, device, api, format
public/              icon.svg, apple-touch-icon.svg
```

## Security notes

- All SQL is parameterized (`prepare().bind()`); all input validated with Zod server-side.
- No secrets in the client bundle; no browser-to-D1 access (all through API routes).
- Sessions: HMAC-signed, 30-day TTL, HttpOnly cookie; Bearer fallback for installed PWAs.
- Admin endpoints require `ADMIN_API_TOKEN`; destructive actions have confirm dialogs and audit logs.
- Rate limiting: in-memory per-isolate buckets on check/activate/function-update routes
  (upgrade to Cloudflare Rate Limiting rules / KV for multi-isolate strictness).
- Device binding uses a random per-browser app ID in localStorage — no fingerprinting.

## Known limitations (V1)

- Realtime tab is polling-free local state + persisted function states (no WebSocket yet;
  architecture allows adding it without UI rewrites).
- Dev fallback store is in-memory (resets on restart); use `wrangler d1` local for persistence.
- Single admin token (no multi-admin roles yet — `users` table reserved for this).
