-- Add precise location to profiles for accurate lunar rendering
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text;
