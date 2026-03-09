-- Luna Loops - Add note field to loops
ALTER TABLE loops ADD COLUMN IF NOT EXISTS note text;
