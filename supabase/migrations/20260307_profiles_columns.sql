-- Cosmic Loops - Ensure all profile columns exist
-- Run this in the Supabase SQL editor if profile saves are failing

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sun_sign text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS moon_sign text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rising_sign text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hemisphere text DEFAULT 'north';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz;
