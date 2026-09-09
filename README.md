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
- Admin: sign in at `/admin` with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your
  local `.env.local` (dev). First sign-in provisions a SUPER_ADMIN (bcrypt hash).

## Admin authentication & roles

- Password login: `POST /api/admin/login` → HttpOnly `zev_admin` cookie (12h) + Bearer-capable token.
- Roles: `SUPER_ADMIN` > `ADMIN` > `SUPPORT`. Destructive actions (revoke, delete) require `ADMIN`+.
- Legacy `ADMIN_API_TOKEN` header still works for scripts (treated as super-admin).
- Login is rate-limited (5/min/IP), failures are audited, passwords are bcrypt-hashed — never stored or logged in plaintext.
- Production: `wrangler secret put ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_API_TOKEN`, `SESSION_SECRET`. Never commit secrets.

## License durations & key presentation

- Durations: `hour` · `day` · `week` · `month` · `custom` (days) · `permanent` (no expiry).
- Each key can carry `display_name`, `avatar`, `notes` (admin-only, never shown to users).
- Avatar values: `zev` (official character) · initials (`JD`) · `https://…` URL · `data:image/png|jpeg|webp` upload (≤96 KB, magic-byte verified server-side; rendered only, never executed).
- `last_used_at` is written on every activation/status read; the admin table shows bound-device counts.

## iOS install profiles (MobileConfig)

- Account → iOS install profile: pick Legacy / Standard / High-Hz → Generate →
  client validates → Download → install in iPhone **Settings** (Profile Downloaded,
  or General → VPN & Device Management). The PWA cannot install profiles silently.
- Profiles contain only documented Apple keys: top-level `Configuration` payload
  + one `com.apple.webClip.managed` shortcut. Presets differ in description,
  auto-removal duration (30d / 1y / 7d), and clip label. No system-setting changes,
  no gameplay effects — see `src/lib/mobileconfig.ts` for exact schema assumptions.
- API: `POST /api/profiles/generate` (session + ACTIVE license, 10/hour/license,
  audited as `profile.created`), `GET /api/profiles/history`.
- Tests: `npm run test:mobileconfig` (needs the app running, `BASE_URL` env) —
  plistlib parse, UUID, required keys, auth, invalid input. Unit checks for
  escaping/determinism run against the real TS module.

## Device telemetry (honest layers)

- Layer 1 (built in): browser facts only — CPU cores, memory estimate, screen, online/offline, connection, battery. Anything the browser hides renders as **Unavailable**, never fabricated.
- Layer 2 (optional companion agent, not included): a local agent on the user's machine could expose real CPU/RAM/GPU/temperature over a secure `https://localhost` + token bridge; the UI already renders "Unavailable" states so an agent can plug in later without redesign. No agent protocol is finalized in V1.

## Character artwork

The Home hero, license screen avatar, welcome popup, and PWA avatar all use
`public/zev-character.png`. Drop the Zev artwork file there (square-ish, ≥512px —
purple art works best with the theme). Until then, a purple gradient + glow
fallback is shown automatically and every icon reference keeps working.

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

- All SQL is parameterized (`prepare().bind()`); dynamic column names are whitelisted; all input validated with Zod server-side.
- License decisions (expiry, status, device limits) are computed server-side from timestamps — the frontend is never trusted.
- Secrets compared in constant time; admin tokens never accepted via URL query params.
- No secrets in the client bundle; no browser-to-D1 access (all through API routes).
- Sessions are revalidated against persistent state on every authenticated
  request: logged-out, unbound, admin-revoked, or expired sessions return 401
  even when the token signature is valid. User logout, device unbind, license
  revoke/suspend, and admin logout all invalidate server-side rows.
- Permanent licenses carry an explicit `is_permanent` flag and never receive
  an expiry from activation/extend paths.
- Browser transport is dual on purpose (HttpOnly `SameSite=lax` cookie plus
  Bearer header with the same token value for installed-PWA edge cases) —
  one authority, server-side revocation enforced for both. Logout clears both.
  A localStorage copy exists only as a transport fallback; it carries no
  extra authority and is rejected server-side once revoked.
- Rate limits are in-memory per isolate: login is throttled per IP (20/min)
  AND per email (5/min); profile generation per license (10/h). Client IP
  comes from `cf-connecting-ip` only when `TRUST_EDGE=cloudflare`, otherwise
  a documented dev fallback. For multi-isolate production strictness, add
  Cloudflare Rate Limiting rules (NOT yet applied — requires dashboard):
  `POST /api/admin/login` (5/min/IP + tighter per-email), `/api/license/*`
  (20/min/IP), `/api/mobileconfig/*` (10/min/IP), `/api/admin/*` mutations
  (30/min/IP + authenticated), with Managed Challenge on repeat offenders.
- License keys are stored reversibly (needed for admin lookup/display and exact-match
  activation). Tradeoff documented: hashing keys at rest (SHA-256 + lookup by hash)
  would remove plaintext secrets from D1 but breaks admin substring search and
  requires a show-once flow everywhere. D1 data is encrypted at rest by Cloudflare
  and reachable only with the Worker's D1 binding — accepted for V1.
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
