-- Add modular observability columns to public.chat_telemetry
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS time_context jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS lunar_context jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS relational_memory jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS voice_input jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS protocols jsonb DEFAULT '{}'::jsonb;
