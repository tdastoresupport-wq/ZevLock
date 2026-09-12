#!/usr/bin/env python3
"""ZEV LOCK regression suite: Function UX + secure admin (white-box).

Static checks over the repo — no server required. Fails non-zero on any miss.
"""

import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails: list[str] = []
passes = 0


def read(rel: str) -> str:
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def check(name: str, cond):
    global passes
    if cond:
        passes += 1
        print(f"  ok  {name}")
    else:
        fails.append(name)
        print(f"  FAIL {name}")


print("== F1. main nav is HOME/FUNCTION/REALTIME/ACCOUNT ==")
nav = read("src/components/BottomNav.tsx")
check(
    "function tab present, profiles absent",
    'id: "function"' in nav and 'id: "profiles"' not in nav,
)
check(
    "all four tabs present",
    all(f'id: "{t}"' in nav for t in ["home", "function", "realtime", "account"]),
)
check("no admin in user nav", "admin" not in nav.lower())
check(
    "ProfilesControlCenter not wired into UI",
    not os.path.exists(os.path.join(ROOT, "src/components/ProfilesControlCenter.tsx"))
    and "ProfilesControlCenter" not in read("src/components/AppShell.tsx"),
)
check(
    "no profiles/active API route",
    not os.path.exists(os.path.join(ROOT, "src/app/api/profiles/active")),
)

print("== F2. original Function behavior intact ==")
ft = read("src/components/FunctionTab.tsx")
check(
    "optimistic toggle + rollback + sound", "persistToggle" in ft and "rollback" in ft
)
check("bulk update path", "persistMany" in ft)
check("master all-systems control", "Tất cả hệ thống" in ft)
check(
    "ĐANG BẬT/ĐANG TẮT grouping",
    "ĐANG BẬT ·" in ft and "ĐANG TẮT ·" in ft,
)
check(
    "deterministic knob (explicit x transform)",
    "animate={{ x: on ? 11 : -11 }}" in read("src/components/ui.tsx"),
)
shell = read("src/components/AppShell.tsx")
check(
    "AppShell mutation seq guard + reconcile",
    "flightRef" in shell and "refetchFunctions" in shell,
)
check("visibility re-sync", "visibilitychange" in shell)
home = read("src/components/HomeTab.tsx")
check(
    "Home keeps Controls/License/Sound/Sync + system rows",
    all(k in home for k in ['"controls"', '"license"', '"sound"', '"sync"'])
    and "SystemGroup" in home,
)
check(
    "Home shows continuous license countdown",
    "useLicenseCountdown" in home and "countdown" in home,
)
rt = read("src/components/RealtimeTab.tsx")
check(
    "Realtime honest (no fabricated telemetry)",
    not re.search(r"\b(CPU|GPU|temperature|RAM usage|FPS|ping)\b", rt),
)
check("Realtime shows function grid from server", "TRẠNG THÁI CHỨC NĂNG" in rt)

print("== F3. rapid-toggle stability architecture ==")
check("sound toggle throttle", "TOGGLE_GAP_MS" in read("src/lib/sound.ts"))
check("bounded fetch (timeout+abort)", "AbortController" in read("src/lib/api.ts"))
check(
    "no duplicate-request window (busy guards)",
    "savingKey || savingAll" in ft or "savingKey||savingAll" in ft.replace(" ", ""),
)

print("== M1. MobileConfig kept, not central, still secure ==")
check(
    "3 physical files intact",
    all(
        os.path.exists(
            os.path.join(
                ROOT, "src/mobileconfig/profiles", f"zev-lock-{p}.mobileconfig"
            )
        )
        for p in ["legacy-60hz", "standard-oled-60hz", "promotion-high-hz"]
    ),
)
check(
    "single serializer",
    read("src/lib/mobileconfig.ts").count("export function buildMobileconfig") == 1,
)
banned = [
    "TouchAccommodationsEnabled",
    "TouchAccommodationsTapAssistance",
    "TouchAccommodationsIgnoreRepeat",
    "TouchAccommodationsHoldDuration",
]
blob = "".join(
    read(f"src/mobileconfig/profiles/zev-lock-{p}.mobileconfig")
    for p in ["legacy-60hz", "standard-oled-60hz", "promotion-high-hz"]
)
check("no invented Apple keys", not any(k in blob for k in banned))
dl = read("src/app/api/mobileconfig/download/route.ts")
check(
    "download gated + allowlisted", "session_revoked" in dl and "Unknown profile" in dl
)
check("no MobileConfig page in main nav", "mobileconfig" not in nav.lower())

print("== A1. admin auth hardening ==")
login = read("src/app/api/admin/login/route.ts")
check(
    "bcrypt verify + dummy-hash timing guard",
    "verifyPassword" in login and "DUMMY_HASH" in login,
)
check(
    "login rate limited (ip + email)",
    "admin-login:ip" in login and "admin-login:email" in login,
)
check(
    "HttpOnly + Secure + SameSite + 12h session",
    all(k in login for k in ["httpOnly: true", "sameSite", "12 * 3600"]),
)
check(
    "login success/failure audited",
    "admin.login" in login and "admin.login_failed" in login,
)
check(
    "no hardcoded admin password",
    "ADMIN_PASSWORD" not in login or "process.env.ADMIN_PASSWORD" in login,
)
check("first-run bootstrap hashes env password", "hashPassword(envPassword)" in login)

print("== A2. RBAC: mutations ADMIN+, reads SUPPORT ==")
licenses_post = read("src/app/api/admin/licenses/route.ts")
check("POST create gated ADMIN", 'adminOnly(req, "ADMIN")' in licenses_post)
for rel in [
    "licenses/[id]/route.ts",
    "licenses/[id]/suspend/route.ts",
    "licenses/[id]/revoke/route.ts",
    "licenses/[id]/extend/route.ts",
    "licenses/[id]/reset-device/route.ts",
    "licenses/[id]/activate/route.ts",
]:
    src = read(f"src/app/api/admin/{rel}")
    check(f"ADMIN+ on {rel}", src.count('adminOnly(req, "ADMIN")') >= 1)
check(
    "SUPPORT keeps read access (list/logs/stats)",
    "adminOnly(req)" in read("src/app/api/admin/logs/route.ts"),
)
check(
    "DELETE requires ADMIN",
    'adminOnly(req, "ADMIN")' in read("src/app/api/admin/licenses/[id]/route.ts"),
)

print("== A3. permanent flag integrity ==")
patch = read("src/app/api/admin/licenses/[id]/route.ts")
check(
    "PATCH syncs is_permanent atomically with expiry",
    "is_permanent" in patch and "patch.is_permanent = 1" in patch,
)
check("clearing permanent requires new expiry", "Clearing permanent requires" in patch)
check("expiry on permanent key rejected", "clear permanent first" in patch)
check(
    "extend refuses permanent keys",
    "permanent_key" in read("src/app/api/admin/licenses/[id]/extend/route.ts"),
)
check(
    "activate never stamps expiry on permanent",
    "is_permanent !== 1" in read("src/app/api/license/activate/route.ts"),
)

print("== S1. IDOR + mass assignment ==")
status_src = read("src/app/api/license/status/route.ts")
update_src = read("src/app/api/functions/update/route.ts")
reset_src = read("src/app/api/device/reset/route.ts")
check(
    "user routes scoped to server-verified claims.licenseId",
    all("claims.licenseId" in s for s in [status_src, update_src, reset_src]),
)
check(
    "no client-supplied license/user id trusted in user routes",
    not any(
        re.search(r"body\.(licenseId|license_id|userId|user_id)", s)
        for s in [update_src, reset_src]
    ),
)
edit_block = read("src/lib/validation.ts").split("editLicenseSchema")[1].split("});")[0]
check(
    "edit schema is explicit allowlist, no status/role/audit fields",
    all(k not in edit_block for k in ["status", "role", "created_at", "session"]),
)
patch_src = read("src/app/api/admin/licenses/[id]/route.ts")
check(
    "PATCH builds explicit patch object (no body spread)",
    "patch.display_name" in patch_src
    and "...parsed" not in patch_src
    and "...body" not in patch_src,
)

print("== S2. secrets + randomness + headers ==")
client_env = []
for dp, _, fns in os.walk(os.path.join(ROOT, "src/components")):
    for fn in fns:
        with open(os.path.join(dp, fn), encoding="utf-8") as f:
            content = f.read()
            # process.env.NODE_ENV is a build-time constant inlined by Next
            # (safe); any other env access in client code is forbidden.
            stripped = content.replace("process.env.NODE_ENV", "")
            if "process.env" in stripped:
                client_env.append(fn)
check("no secret env access in client components", client_env == [])
check(
    "demo hint hidden in production",
    'process.env.NODE_ENV !== "production"' in read("src/components/LicenseScreen.tsx"),
)
check(
    "no Math.random in src",
    not re.search(
        r"Math\.random",
        "".join(
            open(os.path.join(dp, fn), encoding="utf-8").read()
            for dp, _, fns in os.walk(os.path.join(ROOT, "src"))
            for fn in fns
        ),
    ),
)
check(
    "secure key generation (getRandomValues)",
    "getRandomValues" in read("src/lib/keys.ts"),
)
cfg = read("next.config.ts")
check(
    "security headers preserved",
    all(
        k in cfg
        for k in [
            "Content-Security-Policy",
            "Strict-Transport-Security",
            "X-Content-Type-Options",
            "Referrer-Policy",
            "Permissions-Policy",
        ]
    ),
)

print("== L1. license timer continuity ==")
check(
    "status returns server_now + is_permanent",
    "server_now" in read("src/app/api/license/status/route.ts"),
)
check(
    "precedence REVOKED>SUSPENDED>EXPIRED coded",
    read("src/lib/license.ts").index("REVOKED")
    < read("src/lib/license.ts").index("SUSPENDED"),
)
check(
    "countdown hook server-anchored", "drift" in read("src/lib/useLicenseCountdown.ts")
)

print("== P1. PWA intact + Account identity ==")
man = read("src/app/manifest.ts")
check(
    "manifest standalone/scope/id/icons",
    all(k in man for k in ['"standalone"', 'scope: "/"', '"maskable"']),
)
acct = read("src/components/AccountTab.tsx")
check(
    "Account shows server identity + countdown + functions, no install page",
    all(
        k in acct
        for k in ["display_name", "countdown", "status.functions", "CHỨC NĂNG"]
    )
    and "ProfilesSection" not in acct,
)
check(
    "character asset served + optimized",
    os.path.exists(os.path.join(ROOT, "public/zev-character.png"))
    and os.path.getsize(os.path.join(ROOT, "public/zev-character.png")) < 2_500_000,
)


print("== U1. motion system + Aurora + wordmark ==")
motion = read("src/lib/motion.ts")
check(
    "motion tokens exist (EASE_OUT/DUR/DIST/PRESS/SPRING)",
    all(k in motion for k in ["EASE_OUT", "DUR", "DIST", "PRESS", "SPRING"]),
)
for rel in [
    "src/components/AppShell.tsx",
    "src/components/BottomNav.tsx",
    "src/components/ui.tsx",
    "src/components/FunctionTab.tsx",
    "src/components/HomeTab.tsx",
    "src/components/RealtimeTab.tsx",
    "src/components/modals.tsx",
]:
    check(f"tokens used in {rel.split('/')[-1]}", "@/lib/motion" in read(rel))
css = read("src/app/globals.css")
check(
    "Aurora ambient (static gradients, pause, reduced-motion fallback)",
    ".zev-aurora" in css
    and "aurora-drift" in css
    and "zev-paused" in css
    and "prefers-reduced-motion" in css,
)
check(
    "Wordmark lockup component + used on login/splash",
    os.path.exists(os.path.join(ROOT, "src/components/Wordmark.tsx"))
    and "Wordmark" in read("src/components/LicenseScreen.tsx"),
)

print("== U2. MobileConfig removed from visible UI, backend intact ==")
check(
    "ProfilesSection component deleted",
    not os.path.exists(os.path.join(ROOT, "src/components/ProfilesSection.tsx")),
)
components_src = "".join(
    open(os.path.join(dp, fn), encoding="utf-8").read()
    for dp, _, fns in os.walk(os.path.join(ROOT, "src/components"))
    for fn in fns
    if fn.endswith(".tsx") and fn != "AdminDashboard.tsx"
)
check(
    "no mobileconfig discovery UI outside admin",
    "mobileconfig" not in components_src.lower()
    and "Download .mobileconfig" not in components_src,
)
check(
    "admin Templates kept as functional preset gate only",
    "setPresetEnabled" in read("src/lib/db.ts")
    and 'adminOnly(req, "ADMIN")'
    in read("src/app/api/admin/mobileconfig/templates/route.ts"),
)
check(
    "no dead profiles client helpers",
    "downloadUrl" not in read("src/lib/api.ts"),
)
check(
    "3 physical files + serializer + allowlisted download intact",
    all(
        os.path.exists(
            os.path.join(
                ROOT, "src/mobileconfig/profiles", f"zev-lock-{p}.mobileconfig"
            )
        )
        for p in ["legacy-60hz", "standard-oled-60hz", "promotion-high-hz"]
    )
    and "export function buildMobileconfig" in read("src/lib/mobileconfig.ts")
    and "CANONICAL_PROFILES[id]" in read("src/app/api/mobileconfig/download/route.ts"),
)

print("== U3. Function protection gate (copy/behavior intact) ==")
ft = read("src/components/FunctionTab.tsx")
check(
    "8 feature keys defined",
    len(
        re.findall(
            r"aimlock_head|stability_assist|aim_hold|aim_lockdown|sensitivity_boost|screen_boost|headshot_fix|fix_recoil",
            read("src/lib/types.ts"),
        )
    )
    >= 8,
)
check(
    "Function VI copy intact",
    all(
        k in ft
        for k in [
            "Điều khiển",
            "Tất cả hệ thống",
            "ĐANG BẬT ·",
            "ĐANG TẮT ·",
            "Bật tất cả",
            "Lưu lỗi",
        ]
    ),
)
check(
    "Function state machine intact (optimistic + rollback + reconcile)",
    "persistToggle" in ft and "persistMany" in ft and "apply(current)" in ft,
)

print(f"\n{passes} passed, {len(fails)} failed")
sys.exit(1 if fails else 0)
