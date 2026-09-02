-- Add archive metadata columns to public.chat_sessions
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;
