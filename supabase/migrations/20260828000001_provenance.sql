-- Add provenance tracking columns to public.echoes
ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS provenance_author text DEFAULT 'user' CHECK (provenance_author IN ('user', 'ai', 'co-created'));
ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS provenance_kind text DEFAULT 'original_echo' CHECK (provenance_kind IN ('original_echo', 'ai_reflection', 'checkpoint', 'product_note'));
ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS parent_id text REFERENCES public.echoes(id) ON DELETE SET NULL;

-- Add provenance tracking columns to public.loops
ALTER TABLE public.loops ADD COLUMN IF NOT EXISTS provenance_author text DEFAULT 'user' CHECK (provenance_author IN ('user', 'ai', 'co-created'));
ALTER TABLE public.loops ADD COLUMN IF NOT EXISTS provenance_kind text DEFAULT 'original_echo' CHECK (provenance_kind IN ('original_echo', 'ai_reflection', 'checkpoint', 'product_note'));

-- Add database mutations column to public.chat_telemetry for turn-level observability
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS database_mutations jsonb DEFAULT '[]'::jsonb;
