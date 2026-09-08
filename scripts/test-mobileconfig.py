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

    print("== 6. server validate endpoint ==")
    s, rep = api(
        "POST", "/api/mobileconfig/validate", {"preset": "standard"}, token=tok
    )
    check("validate 200 + ok", s == 200 and rep.get("ok") is True, f"got {s} {rep}")
    check("validate schema version", rep.get("schemaVersion") == "1.0.0")
    check("validate uuid v4", bool(UUID_V4.match(rep.get("uuid", ""))))
    s, _ = api("POST", "/api/mobileconfig/validate", {"preset": "standard"})
    check("validate no session -> 401", s == 401, f"got {s}")
    s, _ = api(
        "POST",
        "/api/mobileconfig/validate",
        {"preset": "standard", "PayloadContent": []},
        token=tok,
    )
    check("validate arbitrary keys -> 400", s == 400, f"got {s}")

    print("== 7. download endpoint ==")
    s, gen = api("POST", "/api/mobileconfig/generate", {"preset": "legacy"}, token=tok)
    uuid = gen.get("uuid", "")
    import urllib.request as _url

    req = _url.Request(
        f"{BASE}/api/mobileconfig/download?uuid={uuid}",
        headers={"Authorization": f"Bearer {tok}"},
    )
    try:
        with _url.urlopen(req, timeout=15) as r:
            body = r.read()
            ctype = r.headers.get("Content-Type", "")
            disp = r.headers.get("Content-Disposition", "")
            code = r.status
    except urllib.error.HTTPError as e:
        body, ctype, disp, code = b"", "", "", e.code
    check("download 200", code == 200, f"got {code}")
    check("download content type", ctype == "application/x-apple-aspen-config", ctype)
    check(
        "download disposition",
        disp == 'attachment; filename="zev-lock-legacy.mobileconfig"',
        disp,
    )
    check("download bytes identical", body.decode() == gen.get("xml", ""))
    s, hist = api("GET", "/api/profiles/history", token=tok)
    mine = [i for i in hist.get("items", []) if i.get("uuid") == uuid]
    check(
        "history marks downloaded", len(mine) == 1 and mine[0].get("downloaded") is True
    )
    s, _ = api("GET", "/api/profiles/history", token=tok)
    req2 = _url.Request(
        f"{BASE}/api/mobileconfig/download?uuid=not-a-uuid",
        headers={"Authorization": f"Bearer {tok}"},
    )
    try:
        with _url.urlopen(req2, timeout=15) as r2:
            code2 = r2.status
    except urllib.error.HTTPError as e:
        code2 = e.code
    check("download bad uuid -> 404", code2 == 404, f"got {code2}")

    print("== 8. expired / revoked licenses ==")
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
    A = {"x-admin-token": atok}

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
    s2, act2 = api(
        "POST",
        "/api/license/activate",
        {"key": key2, "device_identifier": "mc_revoke_dev", "platform": "iPhone"},
    )
    tok2 = act2.get("token", "")
    _admin("POST", f"/api/admin/licenses/{nk['license']['id']}/revoke")
    s, _ = api("POST", "/api/mobileconfig/generate", {"preset": "standard"}, token=tok2)
    check("revoked license -> 403", s == 403, f"got {s}")
    lid = nk["license"]["id"]
    _admin("DELETE", f"/api/admin/licenses/{lid}")

    print("== 9. plan validation + IDOR ==")
    s, _ = _admin(
        "POST", "/api/admin/licenses", {"plan": "X" * 100, "duration_preset": "day"}
    )
    check("100-char plan -> 400", s == 400, f"got {s}")
    s, nk2 = _admin(
        "POST",
        "/api/admin/licenses",
        {"plan": "Premium", "duration_preset": "day", "display_name": "MCIdor"},
    )
    s2, act3 = api(
        "POST",
        "/api/license/activate",
        {
            "key": nk2["license"]["key"],
            "device_identifier": "mc_idor_dev",
            "platform": "iPhone",
        },
    )
    tok3 = act3.get("token", "")
    req3 = _url.Request(
        f"{BASE}/api/mobileconfig/download?uuid={uuid}",
        headers={"Authorization": f"Bearer {tok3}"},
    )
    try:
        with _url.urlopen(req3, timeout=15) as r3:
            code3 = r3.status
    except urllib.error.HTTPError as e:
        code3 = e.code
    check("other license uuid -> 404 (IDOR safe)", code3 == 404, f"got {code3}")
    _admin("DELETE", f"/api/admin/licenses/{nk2['license']['id']}")

    print("== 10. admin templates ==")
    s, tpl = _admin("GET", "/api/admin/mobileconfig/templates")
    check(
        "templates 200 + schema",
        s == 200 and tpl.get("schemaVersion") == "1.0.0",
        f"got {s}",
    )
    check("templates 3 presets", s == 200 and len(tpl.get("presets", [])) == 3)
    s, _ = _admin(
        "POST",
        "/api/admin/mobileconfig/templates",
        {"preset": "high-hz", "enabled": False},
    )
    check("disable high-hz", s == 200, f"got {s}")
    s, _ = api("POST", "/api/mobileconfig/generate", {"preset": "high-hz"}, token=tok)
    check("disabled preset -> 403", s == 403, f"got {s}")
    _admin(
        "POST",
        "/api/admin/mobileconfig/templates",
        {"preset": "high-hz", "enabled": True},
    )
    s, _ = api("GET", "/api/admin/mobileconfig/templates")
    check("templates no session -> 401", s == 401, f"got {s}")

    print("== 11. validate rate limit (31 rapid) ==")
    codes = []
    for _ in range(31):
        s, _ = api(
            "POST", "/api/mobileconfig/validate", {"preset": "standard"}, token=tok
        )
        codes.append(s)
    check("validate rate-limited with 429", 429 in codes, f"tail={codes[-3:]}")

    print("== 12. PWA manifest + assets ==")
    try:
        with _url.urlopen(f"{BASE}/manifest.webmanifest", timeout=15) as r:
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
    check(
        "manifest theme colors",
        man.get("theme_color") == "#05060f"
        and man.get("background_color") == "#05060f",
    )
    check(
        "manifest icons", isinstance(man.get("icons"), list) and len(man["icons"]) >= 2
    )
    try:
        with _url.urlopen(f"{BASE}/icon.svg", timeout=15) as r:
            icode = r.status
    except urllib.error.HTTPError as e:
        icode = e.code
    check("icon.svg 200", icode == 200, f"got {icode}")

    print(f"\n{PASS}/{PASS + FAIL} passed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
