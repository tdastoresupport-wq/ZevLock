-- Admin-controlled MobileConfig preset availability.
CREATE TABLE IF NOT EXISTS profile_presets (
  preset TEXT PRIMARY KEY CHECK (preset IN ('legacy', 'standard', 'high-hz')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT OR IGNORE INTO profile_presets (preset, enabled) VALUES
  ('legacy', 1),
  ('standard', 1),
  ('high-hz', 1);
