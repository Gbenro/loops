-- Add focus state to loops (ongoing / paused)
ALTER TABLE loops ADD COLUMN IF NOT EXISTS focus text CHECK (focus IN ('ongoing', 'paused'));
