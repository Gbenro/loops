-- Add voice provenance columns to public.chat_messages
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS input_type text DEFAULT 'text' CHECK (input_type IN ('text', 'voice'));
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
