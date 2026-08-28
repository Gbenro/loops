-- Add recurrence_count to relational_memories to keep strength and empirical recurrence conceptually separable
ALTER TABLE public.relational_memories ADD COLUMN IF NOT EXISTS recurrence_count integer DEFAULT 1;

-- Backfill recurrence_count with existing strength value if null
UPDATE public.relational_memories SET recurrence_count = strength WHERE recurrence_count IS NULL;
