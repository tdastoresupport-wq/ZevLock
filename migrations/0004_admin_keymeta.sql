-- Admin accounts (password-based) + license presentation metadata + usage tracking.

ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE'
  CHECK (status IN ('ACTIVE','SUSPENDED'));
ALTER TABLE users ADD COLUMN last_login_at TEXT;
-- NULL emails (non-admin rows) are not constrained by the unique index in SQLite.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

ALTER TABLE licenses ADD COLUMN display_name TEXT;
ALTER TABLE licenses ADD COLUMN avatar TEXT;
ALTER TABLE licenses ADD COLUMN notes TEXT;
ALTER TABLE licenses ADD COLUMN last_used_at TEXT;
CREATE INDEX IF NOT EXISTS idx_licenses_last_used ON licenses(last_used_at);
