#!/usr/bin/env python3
"""MobileConfig file + API tests for Zev Lock.

Part A — canonical files on disk (no server needed):
  exactly 3 files, names, XML parse, plist dict, required keys,
  UUID v4 + uniqueness, no TouchAccommodations keys, no placeholders,
  exact descriptions, exact organization.
Part B — live API (needs the app running):
  auth, invalid input, generate, validate, ?profile= download mapping,
  byte identity, disabled presets, expired/revoked, IDOR/ownership,
  admin templates, rate limits, PWA manifest, assets.

Usage:
  BASE_URL=http://127.0.0.1:3109 ADMIN_EMAIL=... ADMIN_PASSWORD=... \\
    python3 scripts/test-mobileconfig.py
Exit code 0 = all pass.
"""

import hashlib
import json
import os
import plistlib
import re
import sys
import urllib.request
from pathlib import Path

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3109")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@zev.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "dev-only-admin-pass-123")
DEMO_KEY = os.environ.get("DEMO_LICENSE_KEY", "ZEV-DEMO-2026-VIP1")
REPO = Path(__file__).resolve().parent.parent
PROFILE_DIR = REPO / "src" / "mobileconfig" / "profiles"

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
FORBIDDEN = re.compile(r"TouchAccommodat", re.I)
ORG = "Duc Anh Zev - Đức Anh Zev Trùm File"

EXPECTED = {
    "legacy-60hz": {
        "file": "zev-lock-legacy-60hz.mobileconfig",
        "display": "Zev Lock — Legacy 60Hz",
        "duration": 30 * 86400,
        "description": (
            "App hỗ trợ cấu hình phản hồi cảm ứng của Zev.\n"
            "Device Support: Legacy 60Hz (iPhone 7 / 8 / SE / X / XR / 11)\n"
            "Price: 50 000 VNĐ → 500 000 VNĐ\n"
            "Tiktok: dvmxhontop\n"
            "Đức Anh Zev Trùm File"
        ),
    },
    "standard-oled-60hz": {
        "file": "zev-lock-standard-oled-60hz.mobileconfig",
        "display": "Zev Lock — Standard OLED 60Hz",
        "duration": 365 * 86400,
        "description": (
            "App hỗ trợ cấu hình phản hồi cảm ứng của Zev.\n"
            "Device Support: Standard OLED 60Hz (iPhone 12 / 13 / 14 / 15 / 16 / 17 bản thường)\n"
            "Price: 50 000 VNĐ → 500 000 VNĐ\n"
            "Tiktok: dvmxhontop\n"
            "Đức Anh Zev Trùm File"
        ),
    },
    "promotion-high-hz": {
        "file": "zev-lock-promotion-high-hz.mobileconfig",
        "display": "Zev Lock — Promotion High-Hz",
        "duration": 7 * 86400,
        "description": (
            "App hỗ trợ cấu hình phản hồi cảm ứng của Zev.\n"
            "Device Support: ProMotion High-Hz (iPhone 13 Pro → 17 Pro / Pro Max)\n"
            "Price: 50 000 VNĐ → 500 000 VNĐ\n"
            "Tiktok: dvmxhontop\n"
            "Đức Anh Zev Trùm File"
        ),
    },
}

FILES = {}  # preset -> raw bytes
DOCS = {}  # preset -> parsed plist
UUIDS = []  # all PayloadUUIDs across files


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


def files_section():
    print("== A1. exactly three canonical files ==")
    found = (
        sorted(p.name for p in PROFILE_DIR.glob("*.mobileconfig"))
        if PROFILE_DIR.is_dir()
        else []
    )
    expected_files = sorted(v["file"] for v in EXPECTED.values())
    check("profile dir exists", PROFILE_DIR.is_dir(), str(PROFILE_DIR))
    check("exactly 3 files, correct names", found == expected_files, f"got {found}")

    print("== A2. XML + plist parse, keys, UUIDs, honesty ==")
    for preset, exp in EXPECTED.items():
        path = PROFILE_DIR / exp["file"]
        try:
            raw = path.read_bytes()
        except FileNotFoundError:
            check(f"{preset}: file readable", False)
            continue
        FILES[preset] = raw
        text = raw.decode("utf-8", errors="strict")
        check(
            f"{preset}: xml declaration",
            text.startswith('<?xml version="1.0" encoding="UTF-8"?>'),
        )
        check(
            f"{preset}: plist doctype",
            '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"' in text,
        )
        check(
            f"{preset}: no ellipses/placeholders",
            "..." not in text and "placeholder" not in text.lower(),
        )
        check(f"{preset}: no TouchAccommodations keys", not FORBIDDEN.search(text))
        check(
            f"{preset}: no refresh-rate claims",
            "refresh rate" not in text.lower()
            and "120hz" not in text.lower()
            and "proMotion high-hz"
            not in text.lower().replace("promotion high-hz", ""),
        )
        try:
            doc = plistlib.loads(raw)
            parsed = isinstance(doc, dict)
        except Exception as e:
            parsed = False
            doc = {}
            print(f"       plist error: {e}")
        check(f"{preset}: valid plist dict", parsed)
        if not parsed:
            continue
        DOCS[preset] = doc
        check(
            f"{preset}: required top keys",
            set(doc.keys()) == ALLOWED_TOP,
            f"got {sorted(doc.keys())}",
        )
        check(
            f"{preset}: display name",
            doc.get("PayloadDisplayName") == exp["display"],
            f"got {doc.get('PayloadDisplayName')!r}",
        )
        check(f"{preset}: organization", doc.get("PayloadOrganization") == ORG)
        check(
            f"{preset}: description exact",
            doc.get("PayloadDescription") == exp["description"],
        )
        check(f"{preset}: duration", doc.get("DurationUntilRemoval") == exp["duration"])
        check(
            f"{preset}: version int",
            doc.get("PayloadVersion") == 1
            and isinstance(doc.get("PayloadVersion"), int),
        )
        check(
            f"{preset}: profile uuid v4",
            bool(UUID_V4.match(doc.get("PayloadUUID", ""))),
        )
        content = doc.get("PayloadContent")
        ok_clip = (
            isinstance(content, list)
            and len(content) == 1
            and isinstance(content[0], dict)
        )
        check(f"{preset}: single webclip payload", ok_clip)
        if ok_clip:
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
            UUIDS.append(clip["PayloadUUID"])
        UUIDS.append(doc["PayloadUUID"])
        h = hashlib.sha256(raw).hexdigest()
        print(f"       {exp['file']}: size={len(raw)} sha256={h}")

    print("== A3. cross-file UUID uniqueness ==")
    check(
        "6 uuids, all unique", len(UUIDS) == 6 and len(set(UUIDS)) == 6, f"got {UUIDS}"
    )


def live_section():
    print("== B1. user session ==")
    s, act = api(
        "POST",
        "/api/license/activate",
        {"key": DEMO_KEY, "device_identifier": "mc_test_device", "platform": "iPhone"},
    )
    check("activate demo license", s == 200 and "token" in act, f"got {s}")
    tok = act.get("token", "")

    print("== B2. generate each preset (canonical bytes) ==")
    for preset, exp in EXPECTED.items():
        s, res = api(
            "POST", "/api/mobileconfig/generate", {"preset": preset}, token=tok
        )
        check(f"{preset}: 200", s == 200, f"got {s} {res}")
        if s != 200:
            continue
        check(f"{preset}: filename", res.get("filename") == exp["file"])
        check(
            f"{preset}: content type",
            res.get("contentType") == "application/x-apple-aspen-config",
        )
        check(
            f"{preset}: uuid matches canonical file",
            res.get("uuid") == DOCS.get(preset, {}).get("PayloadUUID"),
        )
        check(
            f"{preset}: xml identical to canonical file",
            (res.get("xml", "").encode()) == FILES.get(preset, b""),
        )

    print("== B3. validate endpoint ==")
    s, rep = api(
        "POST",
        "/api/mobileconfig/validate",
        {"preset": "standard-oled-60hz"},
        token=tok,
    )
    check("validate 200 + ok", s == 200 and rep.get("ok") is True, f"got {s} {rep}")
    check("validate schema version", rep.get("schemaVersion") == "2.0.0")
    s, _ = api("POST", "/api/mobileconfig/validate", {"preset": "standard-oled-60hz"})
    check("validate no session -> 401", s == 401, f"got {s}")
    s, _ = api(
        "POST",
        "/api/mobileconfig/validate",
        {"preset": "standard-oled-60hz", "PayloadContent": []},
        token=tok,
    )
    check("validate arbitrary keys -> 400", s == 400, f"got {s}")
    s, _ = api("POST", "/api/mobileconfig/validate", {"preset": "nope"}, token=tok)
    check("validate unknown preset -> 400", s == 400, f"got {s}")

    print("== B4. ?profile= download mapping ==")
    for preset, exp in EXPECTED.items():
        req = urllib.request.Request(
            f"{BASE}/api/mobileconfig/download?profile={preset}",
            headers={"Authorization": f"Bearer {tok}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                body, code = r.read(), r.status
                ctype = r.headers.get("Content-Type", "")
                disp = r.headers.get("Content-Disposition", "")
        except urllib.error.HTTPError as e:
            body, code, ctype, disp = b"", e.code, "", ""
        check(f"{preset}: 200", code == 200, f"got {code}")
        check(
            f"{preset}: content type",
            ctype == "application/x-apple-aspen-config",
            ctype,
        )
        check(
            f"{preset}: disposition",
            disp == f'attachment; filename="{exp["file"]}"',
            disp,
        )
        check(
            f"{preset}: bytes identical to canonical file",
            body == FILES.get(preset, b""),
        )

    def dl_code(url, token):
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return r.status
        except urllib.error.HTTPError as e:
            return e.code

    check(
        "unknown profile -> 404",
        dl_code(f"{BASE}/api/mobileconfig/download?profile=ultra", tok) == 404,
    )
    check(
        "missing profile -> 404",
        dl_code(f"{BASE}/api/mobileconfig/download", tok) == 404,
    )
    check(
        "path traversal -> 404",
        dl_code(f"{BASE}/api/mobileconfig/download?profile=..%2Fsecret", tok) == 404,
    )
    req_naked = urllib.request.Request(
        f"{BASE}/api/mobileconfig/download?profile=legacy-60hz"
    )
    try:
        with urllib.request.urlopen(req_naked, timeout=15) as r:
            code_naked = r.status
    except urllib.error.HTTPError as e:
        code_naked = e.code
    check("download no session -> 401", code_naked == 401, f"got {code_naked}")

    print("== B5. expired / revoked / disabled ==")
    s, _ = api(
        "POST",
        "/api/license/activate",
        {
            "key": "ZEV-EXP1-RED0-0001",
            "device_identifier": "mc_expired_dev",
            "platform": "iPhone",
        },
    )
    check("expired cannot activate -> 403", s == 403, f"got {s}")
    s, adm = api(
        "POST", "/api/admin/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    check("admin login", s == 200, f"got {s}")
    atok = adm.get("token", "")

    def _admin(method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(BASE + path, data=data, method=method)
        r.add_header("Content-Type", "application/json")
        r.add_header("x-admin-token", atok)
        try:
            with urllib.request.urlopen(r, timeout=15) as resp:
                raw = resp.read().decode()
                return resp.status, (json.loads(raw) if raw else {})
        except urllib.error.HTTPError as e:
            try:
                p = json.loads(e.read().decode() or "{}")
            except Exception:
                p = {}
            return e.code, p

    s, nk = _admin(
        "POST",
        "/api/admin/licenses",
        {"plan": "Premium", "duration_preset": "day", "display_name": "MCTest"},
    )
    key2 = nk.get("license", {}).get("key", "")
    _, act2 = api(
        "POST",
        "/api/license/activate",
        {"key": key2, "device_identifier": "mc_revoke_dev", "platform": "iPhone"},
    )
    tok2 = act2.get("token", "")
    _admin("POST", f"/api/admin/licenses/{nk['license']['id']}/revoke")
    s, _ = api(
        "POST", "/api/mobileconfig/generate", {"preset": "legacy-60hz"}, token=tok2
    )
    check("revoked license -> 403", s == 403, f"got {s}")
    _admin("DELETE", f"/api/admin/licenses/{nk['license']['id']}")

    s, _ = _admin(
        "POST",
        "/api/admin/mobileconfig/templates",
        {"preset": "promotion-high-hz", "enabled": False},
    )
    check("disable promotion-high-hz", s == 200, f"got {s}")
    s, _ = api(
        "POST", "/api/mobileconfig/generate", {"preset": "promotion-high-hz"}, token=tok
    )
    check("disabled generate -> 403", s == 403, f"got {s}")
    check(
        "disabled download -> 403",
        dl_code(f"{BASE}/api/mobileconfig/download?profile=promotion-high-hz", tok)
        == 403,
    )
    _admin(
        "POST",
        "/api/admin/mobileconfig/templates",
        {"preset": "promotion-high-hz", "enabled": True},
    )

    print("== B6. history ownership ==")
    s, hist = api("GET", "/api/mobileconfig/history", token=tok)
    items = hist.get("items", [])
    check(
        "history has downloads",
        s == 200 and any(i.get("downloaded") for i in items),
        f"got {s}/{len(items)}",
    )
    s, nk2 = _admin(
        "POST",
        "/api/admin/licenses",
        {"plan": "Premium", "duration_preset": "day", "display_name": "MCIdor"},
    )
    _, act3 = api(
        "POST",
        "/api/license/activate",
        {
            "key": nk2["license"]["key"],
            "device_identifier": "mc_idor_dev",
            "platform": "iPhone",
        },
    )
    s, hist3 = api("GET", "/api/mobileconfig/history", token=act3.get("token", ""))
    check(
        "other license sees none of ours",
        s == 200
        and all(i.get("license_id", "") != "x" for i in hist3.get("items", []))
        and len(hist3.get("items", [])) == 0,
        f"got {len(hist3.get('items', []))}",
    )
    _admin("DELETE", f"/api/admin/licenses/{nk2['license']['id']}")

    print("== B7. admin templates ==")
    s, tpl = _admin("GET", "/api/admin/mobileconfig/templates")
    presets = tpl.get("presets", []) if s == 200 else []
    check(
        "exactly 3 presets", s == 200 and len(presets) == 3, f"got {s}/{len(presets)}"
    )
    check(
        "template filenames",
        sorted(p.get("filename", "") for p in presets)
        == sorted(v["file"] for v in EXPECTED.values()),
    )
    check(
        "template metadata",
        all(
            p.get("identifier", "").startswith("com.zevlock.profile.")
            and p.get("uuid", "")
            and p.get("sizeBytes", 0) > 500
            for p in presets
        ),
    )
    s, _ = api("GET", "/api/admin/mobileconfig/templates")
    check("templates no session -> 401", s == 401, f"got {s}")

    print("== B8. PWA manifest + assets ==")
    try:
        with urllib.request.urlopen(f"{BASE}/manifest.webmanifest", timeout=15) as r:
            man = json.loads(r.read().decode())
            mcode = r.status
    except Exception as e:
        man, mcode = {}, f"ERR {e}"
    check("manifest 200", mcode == 200, f"got {mcode}")
    check("manifest standalone", man.get("display") == "standalone")
    check(
        "manifest scope+start_url",
        man.get("start_url") == "/" and man.get("scope") == "/",
    )
    try:
        with urllib.request.urlopen(f"{BASE}/icon.svg", timeout=15) as r:
            icode = r.status
    except urllib.error.HTTPError as e:
        icode = e.code
    check("icon.svg 200", icode == 200, f"got {icode}")

    print(f"\n{PASS}/{PASS + FAIL} passed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    files_section()
    try:
        urllib.request.urlopen(BASE + "/manifest.webmanifest", timeout=10).read()
        server_up = True
    except Exception as e:
        server_up = False
        print(f"\nserver unreachable at {BASE} — skipping live API tests ({e})")
    if server_up:
        live_section()
    sys.exit(1 if FAIL else 0)
