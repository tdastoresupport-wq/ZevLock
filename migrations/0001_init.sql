-- Zev Lock D1 schema (V1)
-- Tables: users, licenses, devices, sessions, function_states, logs

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'Premium',
  status TEXT NOT NULL DEFAULT 'UNUSED'
    CHECK (status IN ('UNUSED','ACTIVE','EXPIRED','SUSPENDED','REVOKED')),
  device_limit INTEGER NOT NULL DEFAULT 1 CHECK (device_limit >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  activated_at TEXT,
  expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_plan ON licenses(plan);
CREATE INDEX IF NOT EXISTS idx_licenses_expires ON licenses(expires_at);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  device_identifier TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (license_id, device_identifier)
);
CREATE INDEX IF NOT EXISTS idx_devices_license ON devices(license_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_license ON sessions(license_id);

CREATE TABLE IF NOT EXISTS function_states (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  aimlock_head INTEGER NOT NULL DEFAULT 0,
  stability_assist INTEGER NOT NULL DEFAULT 0,
  aim_hold INTEGER NOT NULL DEFAULT 0,
  aim_lockdown INTEGER NOT NULL DEFAULT 0,
  sensitivity_boost INTEGER NOT NULL DEFAULT 0,
  screen_boost INTEGER NOT NULL DEFAULT 0,
  headshot_fix INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (license_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_function_states_license ON function_states(license_id);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  license_id TEXT REFERENCES licenses(id) ON DELETE SET NULL,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);
CREATE INDEX IF NOT EXISTS idx_logs_license ON logs(license_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
