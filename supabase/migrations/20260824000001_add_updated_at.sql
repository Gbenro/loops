-- Add updated_at columns to loops and echoes tables to prevent schema mismatch errors during updates
ALTER TABLE public.loops ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
