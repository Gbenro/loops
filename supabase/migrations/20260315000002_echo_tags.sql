-- Luna Loops - Echo Tags
-- Adds tags array to echoes for user-defined labeling and filtering

ALTER TABLE echoes ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
