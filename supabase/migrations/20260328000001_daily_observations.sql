-- Daily observations for Rhythm feature
-- Extends rhythm_observations to support multiple check-ins per phase (one per day)

-- Add new columns for daily tracking
ALTER TABLE rhythm_observations
  ADD COLUMN IF NOT EXISTS date_key text,      -- YYYY-MM-DD format for unique day
  ADD COLUMN IF NOT EXISTS day_in_phase integer; -- Day 1, 2, 3... within the phase

-- Backfill date_key from logged_at for existing observations
UPDATE rhythm_observations
SET date_key = to_char(logged_at, 'YYYY-MM-DD')
WHERE date_key IS NULL;

-- Drop the old unique constraint (one per phase)
ALTER TABLE rhythm_observations
  DROP CONSTRAINT IF EXISTS rhythm_observations_cycle_instance_id_phase_key;

-- Create new unique constraint (one per phase per day)
ALTER TABLE rhythm_observations
  ADD CONSTRAINT rhythm_observations_instance_phase_date_key
  UNIQUE (cycle_instance_id, phase, date_key);

-- Index for querying by date
CREATE INDEX IF NOT EXISTS ro_date_key ON rhythm_observations (date_key);
