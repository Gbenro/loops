-- Luna Loops - Soft delete support
-- Run this in the Supabase SQL editor

ALTER TABLE loops ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE echoes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
