-- Demo / development seed data (DEVELOPMENT ONLY).
-- Demo license: ZEV-DEMO-2026-VIP1 (ACTIVE, expires 2031-03-16)
-- Demo admin is authenticated via ADMIN_API_TOKEN env, not via DB.

INSERT OR IGNORE INTO licenses (id, key, plan, status, device_limit, created_at, activated_at, expires_at)
VALUES (
  'lic_demo_vip1',
  'ZEV-DEMO-2026-VIP1',
  'Premium',
  'ACTIVE',
  1,
  '2026-01-10T08:00:00.000Z',
  '2026-01-10T08:05:00.000Z',
  '2031-03-16T00:00:00.000Z'
);

INSERT OR IGNORE INTO licenses (id, key, plan, status, device_limit, created_at, activated_at, expires_at)
VALUES (
  'lic_demo_expired',
  'ZEV-EXP1-RED0-0001',
  'Premium',
  'EXPIRED',
  1,
  '2025-01-10T08:00:00.000Z',
  '2025-01-10T08:05:00.000Z',
  '2025-02-10T00:00:00.000Z'
);

INSERT OR IGNORE INTO licenses (id, key, plan, status, device_limit, created_at, activated_at, expires_at)
VALUES (
  'lic_demo_unused',
  'ZEV-NEW-USER-000001',
  'Premium',
  'UNUSED',
  1,
  '2026-09-01T08:00:00.000Z',
  NULL,
  NULL
);

INSERT OR IGNORE INTO function_states
  (id, license_id, device_id, aimlock_head, stability_assist, aim_hold, aim_lockdown, sensitivity_boost, screen_boost, headshot_fix, updated_at)
VALUES
  ('fs_demo_vip1', 'lic_demo_vip1', NULL, 1, 1, 0, 0, 0, 0, 0, '2026-09-06T22:31:17.000Z');

INSERT OR IGNORE INTO logs (type, license_id, device_id, metadata, created_at) VALUES
  ('license.activated', 'lic_demo_vip1', NULL, '{"plan":"Premium"}', '2026-01-10T08:05:00.000Z'),
  ('function.enabled', 'lic_demo_vip1', NULL, '{"function":"aimlock_head"}', '2026-09-06T22:31:04.000Z'),
  ('function.enabled', 'lic_demo_vip1', NULL, '{"function":"stability_assist"}', '2026-09-06T22:31:17.000Z'),
  ('function.disabled', 'lic_demo_vip1', NULL, '{"function":"aim_hold"}', '2026-09-06T22:33:02.000Z');
