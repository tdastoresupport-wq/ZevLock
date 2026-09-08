-- Add the 8th virtual function toggle: fix_recoil.
ALTER TABLE function_states ADD COLUMN fix_recoil INTEGER NOT NULL DEFAULT 0;
