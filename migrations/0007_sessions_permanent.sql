-- Server-side session revocation (admin) + explicit permanent flag (licenses).
-- is_permanent distinguishes "never expires" from "expiry not yet assigned".
-- Backfill: only rows that are already active AND dateless can safely be
-- marked permanent; keys whose expiry was stamped by activation keep it
-- (documented one-time data consequence, see README).

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id);

ALTER TABLE licenses ADD COLUMN is_permanent INTEGER NOT NULL DEFAULT 0
  CHECK (is_permanent IN (0, 1));

UPDATE licenses SET is_permanent = 1
WHERE status != 'UNUSED' AND expires_at IS NULL;
