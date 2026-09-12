-- Repair admin_sessions FK rewritten by migration 0008.
-- SQLite's ALTER TABLE ... RENAME rewrites stored foreign-key references in
-- OTHER tables: renaming users -> users_legacy silently repointed
-- admin_sessions.admin_id to "users_legacy"(id). After users_legacy was
-- dropped, every admin session INSERT fails (D1 enforces FKs), so admin
-- login always 500s after bootstrap. Rebuild the table with the FK pointing
-- back at users(id), preserving rows.

ALTER TABLE admin_sessions RENAME TO admin_sessions_legacy;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

INSERT INTO admin_sessions (id, admin_id, created_at, expires_at, revoked_at)
  SELECT id, admin_id, created_at, expires_at, revoked_at
  FROM admin_sessions_legacy;

DROP TABLE admin_sessions_legacy;

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id);
