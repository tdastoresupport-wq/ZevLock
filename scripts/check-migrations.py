import sqlite3, glob, os

# Production migration path: schema files in migrations/ in order.
# seeds/*.dev.sql are DEV-ONLY and must never be applied remotely.
db = sqlite3.connect(":memory:")
files = sorted(glob.glob("migrations/*.sql"))
print("ORDER:", [os.path.basename(f) for f in files])
assert not any("seed" in os.path.basename(f).lower() for f in files), (
    "seed file inside migrations/!"
)
for f in files:
    name = os.path.basename(f)
    db.executescript(open(f, encoding="utf-8").read())
    print("APPLIED:", name)
tables = [
    r[0]
    for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1")
]
print("TABLES:", tables)
cols = [r[1] for r in db.execute("PRAGMA table_info(licenses)")]
print("licenses cols:", cols)
# smoke: insert + read a license with all current columns
db.execute(
    "INSERT INTO licenses (id, key, plan, status, device_limit, created_at, activated_at, expires_at,"
    " display_name, avatar, notes, last_used_at, is_permanent) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    (
        "t1",
        "ZEV-TST1-0001-0001",
        "VIP",
        "ACTIVE",
        1,
        "2026-01-01T00:00:00.000Z",
        None,
        None,
        "QA",
        "zev",
        "n",
        None,
        1,
    ),
)
print(
    "license roundtrip:",
    db.execute("SELECT key, plan, is_permanent FROM licenses WHERE id='t1'").fetchone(),
)
# Regression: function_states upsert must survive repeated writes (the route
# upserts the same id on every toggle; wrong conflict target = 500 on 2nd write).
UPSERT = (
    "INSERT INTO function_states (id, license_id, device_id, aimlock_head,"
    " stability_assist, aim_hold, aim_lockdown, sensitivity_boost, screen_boost,"
    " headshot_fix, fix_recoil, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
    " ON CONFLICT(id) DO UPDATE SET aimlock_head = excluded.aimlock_head,"
    " updated_at = excluded.updated_at"
)
db.execute(
    UPSERT,
    ("fs_t1_shared", "t1", None, 1, 0, 0, 0, 0, 0, 0, 0, "2026-09-10T00:00:00.000Z"),
)
db.execute(
    UPSERT,
    ("fs_t1_shared", "t1", None, 0, 0, 0, 0, 0, 0, 0, 0, "2026-09-10T00:01:00.000Z"),
)
assert (
    db.execute(
        "SELECT aimlock_head FROM function_states WHERE id='fs_t1_shared'"
    ).fetchone()[0]
    == 0
)
assert (
    db.execute("SELECT COUNT(*) FROM function_states WHERE license_id='t1'").fetchone()[
        0
    ]
    == 1
)
print("function_states repeated-upsert OK")
# Regression: users.role CHECK must accept the real RBAC roles (bootstrap
# writes SUPER_ADMIN; the V1 CHECK only allowed user/admin on real D1).
db.execute(
    "INSERT INTO users (id, role, created_at, email, password_hash, name, status, last_login_at)"
    " VALUES (?,?,?,?,?,?,?,?)",
    (
        "adm_t1",
        "SUPER_ADMIN",
        "2026-09-10T00:00:00.000Z",
        "a@x.y",
        "h",
        "O",
        "ACTIVE",
        None,
    ),
)
assert (
    db.execute("SELECT role FROM users WHERE id='adm_t1'").fetchone()[0]
    == "SUPER_ADMIN"
)
print("users RBAC roles OK")
# Regression: no leftover references to renamed staging tables (migration
# 0008's RENAME rewrote admin_sessions' FK to users_legacy; must be repaired).
stale = db.execute(
    "SELECT name FROM sqlite_master WHERE sql LIKE '%users_legacy%' OR sql LIKE '%admin_sessions_legacy%'"
).fetchall()
assert stale == [], f"stale staging-table references: {stale}"
fk = db.execute("SELECT sql FROM sqlite_master WHERE name='admin_sessions'").fetchone()[
    0
]
assert "REFERENCES users(id)" in fk, "admin_sessions FK must point at users(id)"
print("staging-table references clean, admin_sessions FK OK")
print("MIGRATION CHECK OK")
