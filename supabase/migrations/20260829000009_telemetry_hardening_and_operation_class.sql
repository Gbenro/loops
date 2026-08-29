-- Add operation_class and voice feedback columns to chat_telemetry
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS operation_class text DEFAULT 'conversation';
ALTER TABLE public.chat_telemetry ADD COLUMN IF NOT EXISTS voice_feedback jsonb DEFAULT '{}'::jsonb;
