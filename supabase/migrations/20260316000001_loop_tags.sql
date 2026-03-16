-- Luna Loops - Loop Tags
-- Adds tags array to loops for labeling and filtering

ALTER TABLE loops ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
