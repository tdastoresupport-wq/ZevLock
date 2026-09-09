#!/usr/bin/env python3
"""Startup hardening tests for Zev Lock.

Asserts the splash screen can never hang forever:
- startup APIs fail fast (no unbounded requests server-side)
- malformed sessions are rejected immediately
- boot code uses bounded fetch (AbortController) + guarded storage
- boot failure surfaces a retry path (LicenseScreen notice)
- character asset state is recorded but never blocks serving /
- reduced-motion CSS + PWA manifest intact
- dev CSP allows the Next.js dev runtime; prod CSP stays strict

Usage:
  BASE_URL=http://127.0.0.1:3002 python3 scripts/test-startup.py
Exit code 0 = all pass.
"""

import os
import re
import sys
import time
import urllib.request
from pathlib import Path

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3002")
REPO = Path(__file__).resolve().parent.parent

PASS = 0
FAIL = 0


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ok  {name}")
    else:
        FAIL += 1
        print(f"  FAIL {name} {detail}")


def get(path, timeout=15):
    req = urllib.request.Request(BASE + path)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def post_json(path, body, timeout=15):
    data = __import__("json").dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def src(relative):
    return (REPO / relative).read_text(encoding="utf-8")


def main():
    print("== T1. shell serves fast ==")
    t0 = time.time()
    code, body, _ = get("/")
    dt = time.time() - t0
    check("GET / 200", code == 200, f"got {code}")
    check("GET / under 5s", dt < 5, f"{dt:.1f}s")
    check("splash shell markup present", b"zev-splash-logo" in body)

    print("== T2. license API success path ==")
    t0 = time.time()
    code, _ = post_json("/api/license/check", {"key": "ZEV-DEMO-2026-VIP1"})
    check("check demo 200 fast", code == 200 and (time.time() - t0) < 5, f"got {code}")

    print("== T3. license API failure path ==")
    code, _ = post_json("/api/license/check", {"key": "NOPE"})
    check("bad key 400 fast", code == 400, f"got {code}")

    print("== T4. session API failure paths ==")
    code, _, _ = get("/api/license/status")
    check("no token 401", code == 401, f"got {code}")
    req = urllib.request.Request(
        BASE + "/api/license/status",
        headers={"Authorization": "Bearer malformed.token.here"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            mcode = r.status
    except urllib.error.HTTPError as e:
        mcode = e.code
    check("malformed session 401", mcode == 401, f"got {mcode}")

    print("== T5. character asset recorded, never blocking ==")
    code, _, _ = get("/zev-character.png")
    print(f"       /zev-character.png -> {code} (recorded; fallback covers either way)")
    code, _, _ = get("/")
    check("shell still 200 regardless of asset", code == 200, f"got {code}")

    print("== T6. boot code is bounded (white-box) ==")
    api = src("src/lib/api.ts")
    check(
        "AbortController timeout helper exists",
        "AbortController" in api and "fetchWithTimeout" in api,
    )
    shell = src("src/components/AppShell.tsx")
    check("boot refresh uses bounded fetch", "fetchWithTimeout" in shell)
    check("no raw unbounded fetch in boot path", "await fetch(" not in shell)
    check("storage access guarded", "storageGet(" in shell)
    lic = src("src/components/LicenseScreen.tsx")
    check("boot failure has retry UI", "onRetry" in lic and 'role="alert"' in lic)

    print("== T7. reduced motion + PWA intact ==")
    css_files = list((REPO / ".next" / "static" / "css").rglob("*.css"))
    css = "\n".join(p.read_text(encoding="utf-8", errors="ignore") for p in css_files)
    check("prefers-reduced-motion shipped", "prefers-reduced-motion" in css)
    code, raw, _ = get("/manifest.webmanifest")
    import json as _j

    man = _j.loads(raw.decode()) if code == 200 else {}
    check("manifest standalone", man.get("display") == "standalone")

    print("== T8. CSP: dev allows runtime, prod stays strict (white-box) ==")
    cfg = src("next.config.ts")
    check("dev-gated unsafe-eval", "unsafe-eval" in cfg and "isDev" in cfg)
    code_lines = [ln for ln in cfg.splitlines() if not ln.strip().startswith("*")]
    check(
        "unsafe-eval only in dev branch",
        sum(ln.count("unsafe-eval") for ln in code_lines) == 1 and "isDev ?" in cfg,
    )

    print(f"\n{PASS}/{PASS + FAIL} passed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    try:
        urllib.request.urlopen(BASE + "/", timeout=10).read()
    except Exception as e:
        print(f"server unreachable at {BASE} ({e})")
        sys.exit(2)
    sys.exit(main())
