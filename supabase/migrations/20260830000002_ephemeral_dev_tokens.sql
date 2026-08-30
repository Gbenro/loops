-- ============================================================================
-- Migration: 20260830000002_ephemeral_dev_tokens.sql
-- Description: Add ephemeral token fields to dev_sessions table
-- ============================================================================

ALTER TABLE public.dev_sessions
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dev_sessions_token ON public.dev_sessions(token);
