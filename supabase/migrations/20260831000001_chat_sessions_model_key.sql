-- Add model_key column to public.chat_sessions for per-conversation model persistence
ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS model_key text DEFAULT 'anthropic-fable';
