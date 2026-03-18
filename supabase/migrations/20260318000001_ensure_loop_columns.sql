-- Ensure all loop columns exist (some may be missing from original manual table creation)
ALTER TABLE loops ADD COLUMN IF NOT EXISTS type text DEFAULT 'phase';
ALTER TABLE loops ADD COLUMN IF NOT EXISTS phase_name text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS lunar_month_opened text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS moon_age_opened float;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS zodiac_opened text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS window_end timestamptz;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS opened_at timestamptz;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS released_at timestamptz;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS phase_closed text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS phase_name_closed text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS lunar_month_closed text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS linked_to text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS auto_closed_reason text;
