#!/usr/bin/env python3
"""MobileConfig integration tests for Zev Lock.

Covers: XML parse (plistlib), plist serialization/types, UUID v4 format,
required keys, escaping, invalid input, authorization, API behavior.

Usage:
  BASE_URL=http://127.0.0.1:3109 ADMIN_EMAIL=... ADMIN_PASSWORD=... \\
    python3 scripts/test-mobileconfig.py

Exit code 0 = all pass.
"""

import json
import os
import plistlib
import re
import sys
import urllib.request

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3109")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@zev.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "dev-only-admin-pass-123")
DEMO_KEY = os.environ.get("DEMO_LICENSE_KEY", "ZEV-DEMO-2026-VIP1")

PASS = 0
FAIL = 0

UUID_V4 = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.I
)
ALLOWED_TOP = {
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
}
ALLOWED_CLIP = {
    "FullScreen",
    "IsRemovable",
    "Label",
    "PayloadDescription",
    "PayloadDisplayName",
    "PayloadIdentifier",
    "PayloadType",
    "PayloadUUID",
    "PayloadVersion",
    "URL",
}


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ok  {name}")
    else:
        FAIL += 1
        print(f"  FAIL {name} {detail}")


def api(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read().decode() or "{}")
        except Exception:
            payload = {}
        return e.code, payload


def main():
    print("== 1. user session ==")
    s, act = api(
        "POST",
        "/api/license/activate",
        {"key": DEMO_KEY, "device_identifier": "mc_test_device", "platform": "iPhone"},
    )
    check("activate demo license", s == 200 and "token" in act, f"got {s}")
    tok = act.get("token", "")

    print("== 2. authorization ==")
    s, _ = api("POST", "/api/profiles/generate", {"preset": "standard"})
    check("no session -> 401", s == 401, f"got {s}")
    s, _ = api(
        "POST",
        "/api/profiles/generate",
        {"preset": "standard"},
        token="forged.token.here",
    )
    check("forged token -> 401", s == 401, f"got {s}")

    print("== 3. invalid input ==")
    s, _ = api("POST", "/api/profiles/generate", {"preset": "ultra"}, token=tok)
    check("unknown preset -> 400", s == 400, f"got {s}")
    s, _ = api("POST", "/api/profiles/generate", {}, token=tok)
    check("missing preset -> 400", s == 400, f"got {s}")

    print("== 4. generate + validate each preset ==")
    for preset, duration in (
        ("legacy", 30 * 86400),
        ("standard", 365 * 86400),
        ("high-hz", 7 * 86400),
    ):
        s, res = api("POST", "/api/profiles/generate", {"preset": preset}, token=tok)
        check(f"{preset}: 200", s == 200, f"got {s} {res}")
        if s != 200:
            continue
        check(
            f"{preset}: filename",
            res.get("filename") == f"zev-lock-{preset}.mobileconfig",
        )
        check(
            f"{preset}: content type",
            res.get("contentType") == "application/x-apple-aspen-config",
        )
        xml = res.get("xml", "")
        check(
            f"{preset}: xml declaration",
            xml.startswith('<?xml version="1.0" encoding="UTF-8"?>'),
        )
        check(
            f"{preset}: plist doctype",
            '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"' in xml,
        )
        check(f"{preset}: no ellipses", "..." not in xml)
        try:
            doc = plistlib.loads(xml.encode())
            parsed = True
        except Exception as e:
            parsed = False
            doc = {}
            print(f"       plist parse error: {e}")
        check(f"{preset}: plistlib parses", parsed)
        if parsed:
            check(
                f"{preset}: top keys exact",
                set(doc.keys()) == ALLOWED_TOP,
                f"got {sorted(doc.keys())}",
            )
            check(f"{preset}: PayloadType", doc.get("PayloadType") == "Configuration")
            check(
                f"{preset}: version int",
                isinstance(doc.get("PayloadVersion"), int)
                and doc["PayloadVersion"] == 1,
            )
            check(
                f"{preset}: display name", doc.get("PayloadDisplayName") == "Zev Lock"
            )
            check(
                f"{preset}: organization",
                doc.get("PayloadOrganization") == "Duc Anh Zev - Đức Anh Zev Trùm File",
            )
            check(
                f"{preset}: duration",
                doc.get("DurationUntilRemoval") == duration,
                f"got {doc.get('DurationUntilRemoval')}",
            )
            check(
                f"{preset}: removable bool",
                doc.get("PayloadRemovalDisallowed") is False,
            )
            check(
                f"{preset}: profile uuid v4",
                bool(UUID_V4.match(doc.get("PayloadUUID", ""))),
            )
            content = doc.get("PayloadContent")
            check(
                f"{preset}: one payload",
                isinstance(content, list) and len(content) == 1,
            )
            if isinstance(content, list) and content:
                clip = content[0]
                check(
                    f"{preset}: clip keys exact",
                    set(clip.keys()) == ALLOWED_CLIP,
                    f"got {sorted(clip.keys())}",
                )
                check(
                    f"{preset}: clip type",
                    clip.get("PayloadType") == "com.apple.webClip.managed",
                )
                check(
                    f"{preset}: clip uuid v4",
                    bool(UUID_V4.match(clip.get("PayloadUUID", ""))),
                )
                check(
                    f"{preset}: clip url preset",
                    f"utm_preset={preset}" in clip.get("URL", ""),
                )
                check(
                    f"{preset}: clip booleans",
                    clip.get("FullScreen") is True and clip.get("IsRemovable") is True,
                )
            check(
                f"{preset}: response uuid matches",
                res.get("uuid") == doc.get("PayloadUUID"),
            )

    print("== 5. history ==")
    s, hist = api("GET", "/api/profiles/history", token=tok)
    items = hist.get("items", [])
    check(
        "history 200 + latest 3 presets",
        s == 200
        and {i.get("preset") for i in items[:3]} == {"legacy", "standard", "high-hz"},
        f"got {s}/{len(items)}",
    )
    check(
        "history identifiers",
        all(i.get("identifier", "").startswith("com.zevlock.profile.") for i in items),
    )

    print(f"\n{PASS}/{PASS + FAIL} passed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
