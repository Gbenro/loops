-- Cosmic Loops - Encryption support
-- Run this in the Supabase SQL editor

ALTER TABLE echoes ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS encryption_verify_token text;
