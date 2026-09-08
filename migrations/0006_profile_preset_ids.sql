-- Preset IDs renamed to the canonical three profiles.
-- No production entitlements stored here (pure availability flags), so a
-- clean recreate is safe.
DROP TABLE IF EXISTS profile_presets;

CREATE TABLE profile_presets (
  preset TEXT PRIMARY KEY CHECK (preset IN ('legacy-60hz', 'standard-oled-60hz', 'promotion-high-hz')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO profile_presets (preset, enabled) VALUES
  ('legacy-60hz', 1),
  ('standard-oled-60hz', 1),
  ('promotion-high-hz', 1);
