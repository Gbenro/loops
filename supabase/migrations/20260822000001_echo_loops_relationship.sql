-- Luna Loops - Echo ↔ Loop Multi-relationship support
-- Adds a loop_ids array to echoes to relate a single reflection to multiple awareness loops,
-- and backfills it from the legacy single linked_loop_id column.

-- Add loop_ids column
ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS loop_ids jsonb DEFAULT '[]'::jsonb;

-- Backfill from linked_loop_id
UPDATE public.echoes
SET loop_ids = jsonb_build_array(linked_loop_id)
WHERE linked_loop_id IS NOT NULL AND (loop_ids IS NULL OR jsonb_array_length(loop_ids) = 0);
