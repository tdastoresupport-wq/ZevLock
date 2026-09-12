-- Fix users.role CHECK for the real RBAC roles.
-- 0001 predates roles (CHECK was ('user','admin')) but the app writes
-- SUPER_ADMIN / ADMIN / SUPPORT, so bootstrap/creation fails on real D1
-- with SQLITE_CONSTRAINT_CHECK. (The in-memory dev fallback never enforces
-- CHECKs, which is why this only surfaced against production D1.)
-- SQLite cannot ALTER a CHECK: rebuild the table preserving every row.
-- Legacy values ('user','admin') remain accepted.

ALTER TABLE users RENAME TO users_legacy;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  email TEXT,
  password_hash TEXT,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  last_login_at TEXT
);

INSERT INTO users (id, role, created_at, email, password_hash, name, status, last_login_at)
  SELECT id, role, created_at, email, password_hash, name, status, last_login_at
  FROM users_legacy;

DROP TABLE users_legacy;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
