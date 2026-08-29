-- Add inference economics, context breakdown, field coverage, and voice output to public.chat_telemetry
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS token_usage jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS inference_cost jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS context_breakdown jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS context_budget jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS field_coverage jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS voice_output jsonb DEFAULT '{}'::jsonb;
