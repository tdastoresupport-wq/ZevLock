#!/usr/bin/env python3
"""Security regression tests for Zev Lock (F-AUTH-01, F-LIC-01, F-RATE-01,
F-HDR-01, F-AUTH-02, F-FILE-01). Needs the app running.

Usage:
  BASE_URL=http://127.0.0.1:3111 ADMIN_EMAIL=... ADMIN_PASSWORD=... \\
    python3 scripts/test-security.py
Exit code 0 = all pass.
"""

import base64
import concurrent.futures
import json
import os
import struct
import sys
import urllib.request
import zlib

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3111")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@zev.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "dev-only-admin-pass-123")
DEMO_KEY = os.environ.get("DEMO_LICENSE_KEY", "ZEV-DEMO-2026-VIP1")

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


def api(method, path, body=None, token=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else {}), dict(r.headers)
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read().decode() or "{}")
        except Exception:
            payload = {}
        return e.code, payload, dict(e.headers)


def png_bytes(w, h):
    def chunk(t, d):
        c = t + d
        return (
            struct.pack(">I", len(d))
            + c
            + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    raw = b"\x00" + b"\x00" * (w * 3)
    import zlib as _z

    idat = _z.compress(raw * h)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", idat)
        + chunk(b"IEND", b"")
    )


def jpeg_bytes(w, h):
    # Minimal parseable JPEG: SOI, APP0, DQT, SOF0 (dims), EOI.
    out = b"\xff\xd8"
    out += b"\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    out += b"\xff\xdb\x00\x43\x00" + bytes([1] * 64)
    out += b"\xff\xc0\x00\x11\x08" + struct.pack(">H", h) + struct.pack(">H", w)
    out += b"\x03\x01\x11\x00\x02\x11\x01\x03\x11\x01"
    out += b"\xff\xd9"
    return out


def webp_bytes(w, h, lossless=True):
    if lossless:
        n = ((h - 1) << 14) | (w - 1)
        payload = b"\x2f" + struct.pack("<I", n)
        size = 4 + len(payload)
        return (
            b"RIFF"
            + struct.pack("<I", size)
            + b"WEBP"
            + b"VP8L"
            + struct.pack("<I", len(payload))
            + payload
        )
    # Lossy VP8: 3-byte frame tag, then start code, then dims.
    payload = b"\x10\x00\x00\x9d\x01\x2a" + bytes(
        [w & 0xFF, (w >> 8) & 0x3F, h & 0xFF, (h >> 8) & 0x3F]
    )
    size = 4 + len(payload)
    return (
        b"RIFF"
        + struct.pack("<I", size)
        + b"WEBP"
        + b"VP8 "
        + struct.pack("<I", len(payload))
        + payload
    )


def data_url(mime, raw):
    return f"data:image/{mime};base64," + base64.b64encode(raw).decode()


def main():
    print("== S1. admin login + user session ==")
    import time as _time

    # Retry past 429s: back-to-back suite runs share the per-email budget.
    adm, s = {}, 0
    for _attempt in range(9):
        s, adm, _ = api(
            "POST",
            "/api/admin/login",
            {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        if s != 429:
            break
        _time.sleep(10)
    check("admin login", s == 200 and "token" in adm, f"got {s}")
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

    # fresh device slot on the demo key
    demo_id = _admin("GET", "/api/admin/licenses?search=ZEV-DEMO")[1]["items"][0]["id"]
    _admin("POST", f"/api/admin/licenses/{demo_id}/reset-device")
    s, act, _ = api(
        "POST",
        "/api/license/activate",
        {"key": DEMO_KEY, "device_identifier": "sec_audit_dev", "platform": "iPhone"},
    )
    check("user activate", s == 200, f"got {s}")
    tok = act.get("token", "")

    print("== S6. F-AUTH-02 same external result ==")
    s1, b1, _ = api(
        "POST",
        "/api/admin/login",
        {"email": "nobody-here-zzz@example.com", "password": "wrongpw"},
        headers={"x-forwarded-for": "10.10.10.1"},
    )
    s2, b2, _ = api(
        "POST",
        "/api/admin/login",
        {"email": ADMIN_EMAIL, "password": "wrongpw"},
        headers={"x-forwarded-for": "10.10.10.2"},
    )
    check(
        "unknown vs known+wrong: same code+message",
        s1 == s2 == 401 and b1.get("error") == b2.get("error"),
        f"{s1}/{s2}",
    )

    print("== S2. F-AUTH-01 logout revocation ==")
    s, _, _ = api("POST", "/api/session/logout", token=tok)
    check("logout ok", s == 200, f"got {s}")
    s, body, _ = api(
        "GET", "/api/license/status?device_identifier=sec_audit_dev", token=tok
    )
    check(
        "reuse after logout -> 401",
        s == 401 and body.get("code") == "session_revoked",
        f"got {s} {body}",
    )
    s, _, _ = api(
        "POST", "/api/functions/update", {"states": {"aim_hold": True}}, token=tok
    )
    check("mutation after logout -> 401", s == 401, f"got {s}")

    print("== S3. F-AUTH-01 revoke + unbind ==")
    s, act2, _ = api(
        "POST",
        "/api/license/activate",
        {"key": DEMO_KEY, "device_identifier": "sec_audit_dev", "platform": "iPhone"},
    )
    tok2 = act2.get("token", "")
    s, nk = _admin(
        "POST",
        "/api/admin/licenses",
        {"plan": "Premium", "duration_preset": "day", "display_name": "SecTest"},
    )
    lid, key2 = nk["license"]["id"], nk["license"]["key"]
    _, a3, _ = api(
        "POST",
        "/api/license/activate",
        {"key": key2, "device_identifier": "sec_revoke_dev", "platform": "iPhone"},
    )
    tok3 = a3.get("token", "")
    _admin("POST", f"/api/admin/licenses/{lid}/revoke")
    s, body, _ = api(
        "GET", "/api/license/status?device_identifier=sec_revoke_dev", token=tok3
    )
    check("revoked session -> 401", s == 401, f"got {s} {body}")
    _admin("DELETE", f"/api/admin/licenses/{lid}")

    # parallel mutations racing a revoke on the demo key
    before = api("GET", "/api/functions", token=tok2)[1].get("functions", {})
    _admin("POST", f"/api/admin/licenses/{demo_id}/reset-device")
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        futs = [
            ex.submit(
                api,
                "POST",
                "/api/functions/update",
                {"states": {"aim_hold": True}},
                tok2,
            )
            for _ in range(5)
        ]
        codes = sorted(f[0] for f in (ft.result() for ft in futs))
    check(
        "mutations after unbind all 401", all(c == 401 for c in codes), f"got {codes}"
    )
    s, act4, _ = api(
        "POST",
        "/api/license/activate",
        {"key": DEMO_KEY, "device_identifier": "sec_audit_dev", "platform": "iPhone"},
    )
    tok4 = act4.get("token", "")
    after = api("GET", "/api/functions", token=tok4)[1].get("functions", {})
    check("no mutation slipped through", after == before, f"{before} -> {after}")

    print("== S4. F-LIC-01 permanent + durations ==")
    s, pm = _admin(
        "POST",
        "/api/admin/licenses",
        {"plan": "VIP", "duration_preset": "permanent", "display_name": "PermSec"},
    )
    pmid = pm["license"]["id"]
    _, pa, _ = api(
        "POST",
        "/api/license/activate",
        {
            "key": pm["license"]["key"],
            "device_identifier": "sec_perm_dev",
            "platform": "iPhone",
        },
    )
    st = api(
        "GET",
        "/api/license/status?device_identifier=sec_perm_dev",
        token=pa.get("token", ""),
    )[1]
    check(
        "permanent expires_at NULL after activate",
        st.get("license", {}).get("expires_at") is None,
        f"got {st.get('license', {})}",
    )
    s, ext = _admin("POST", f"/api/admin/licenses/{pmid}/extend", {"extra_days": 30})
    check(
        "extend permanent -> 400",
        s == 400 and ext.get("code") == "permanent_key",
        f"got {s} {ext}",
    )
    s, wk = _admin(
        "POST",
        "/api/admin/licenses",
        {"plan": "Free", "duration_preset": "week", "display_name": "WeekSec"},
    )
    check("week expiry populated", bool(wk["license"]["expires_at"]), f"got {wk}")
    s, mo = _admin(
        "POST",
        "/api/admin/licenses",
        {"plan": "Free", "duration_preset": "month", "display_name": "MonthSec"},
    )
    check("month expiry populated", bool(mo["license"]["expires_at"]), f"got {mo}")
    _admin("POST", f"/api/admin/licenses/{pmid}/revoke")
    s, _, _ = api(
        "POST",
        "/api/license/activate",
        {
            "key": pm["license"]["key"],
            "device_identifier": "sec_perm_dev2",
            "platform": "iPhone",
        },
    )
    check("revoked permanent rejected", s == 403, f"got {s}")
    for _id in (pmid, wk["license"]["id"], mo["license"]["id"]):
        _admin("DELETE", f"/api/admin/licenses/{_id}")

    print("== S5. F-RATE-01 per-email throttle across spoofed IPs ==")
    codes = []
    for i in range(6):
        s, _, _ = api(
            "POST",
            "/api/admin/login",
            {"email": ADMIN_EMAIL, "password": "wrongpw"},
            headers={"x-forwarded-for": f"10.9.9.{i}"},
        )
        codes.append(s)
    check(
        "per-email throttle hits 429 despite IP rotation", 429 in codes, f"got {codes}"
    )

    print("== S7. F-HDR-01 headers ==")
    import urllib.request as _u

    with _u.urlopen(BASE + "/", timeout=15) as r:
        h = {k.lower(): v for k, v in r.headers.items()}
    check("nosniff", h.get("x-content-type-options") == "nosniff")
    check("referrer", h.get("referrer-policy") == "strict-origin-when-cross-origin")
    check("permissions", "camera=()" in h.get("permissions-policy", ""))
    check("frame sameorigin", h.get("x-frame-options") == "SAMEORIGIN")
    check("hsts", h.get("strict-transport-security", "").startswith("max-age=31536000"))
    csp = h.get("content-security-policy", "")
    check(
        "csp basics",
        "default-src 'self'" in csp
        and "object-src 'none'" in csp
        and "unsafe-eval" not in csp
        and "frame-ancestors 'self'" in csp,
    )
    with _u.urlopen(BASE + "/manifest.webmanifest", timeout=15) as r:
        check(
            "manifest csp nosniff", r.headers.get("X-Content-Type-Options") == "nosniff"
        )

    print("== S8. F-FILE-01 uploads ==")

    def avatar_case(name, mime, raw, expect):
        av = data_url(mime, raw)
        s, res = _admin(
            "POST",
            "/api/admin/licenses",
            {
                "plan": "Free",
                "duration_preset": "day",
                "display_name": "AvTest",
                "avatar": av,
            },
        )
        ok = (s == 201) if expect else (s == 400)
        check(f"avatar {name} -> {'201' if expect else '400'}", ok, f"got {s} {res}")
        if s == 201:
            _admin("DELETE", f"/api/admin/licenses/{res['license']['id']}")

    avatar_case("valid png 64", "png", png_bytes(64, 64), True)
    avatar_case("valid jpeg 100x80", "jpeg", jpeg_bytes(100, 80), True)
    avatar_case("valid webp lossless", "webp", webp_bytes(48, 48, True), True)
    avatar_case("valid webp lossy", "webp", webp_bytes(48, 48, False), True)
    avatar_case("svg rejected", "png", b"<svg xmlns='x'></svg>", False)
    avatar_case("wrong magic", "png", b"NOTANIMAGE" * 10, False)
    avatar_case("truncated png", "png", png_bytes(64, 64)[:10], False)
    avatar_case("huge dims 5000", "png", png_bytes(5000, 40)[:200], False)
    avatar_case("tiny 8px", "png", png_bytes(8, 8), False)
    avatar_case("huge file", "png", png_bytes(64, 64) + b"\x00" * (100 * 1024), False)

    print(f"\n{PASS}/{PASS + FAIL} passed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    try:
        urllib.request.urlopen(BASE + "/manifest.webmanifest", timeout=10).read()
    except Exception as e:
        print(f"server unreachable at {BASE} ({e})")
        sys.exit(2)
    sys.exit(main())
