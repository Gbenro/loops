-- ============================================================================
-- Migration: 20260830000001_dev_bridge_schema.sql
-- Description: Luna Development Bridge V1 - Durable Development Service Schema
-- Tables: dev_issues, dev_sessions, dev_events
-- ============================================================================

-- 1. Development Issues
CREATE TABLE IF NOT EXISTS public.dev_issues (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  acceptance_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'proposed',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_agent TEXT NOT NULL DEFAULT 'gemini',
  related_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dev_issues_user_status ON public.dev_issues(user_id, status);
CREATE INDEX IF NOT EXISTS idx_dev_issues_created_at ON public.dev_issues(created_at DESC);

-- 2. Dev Sessions (Bounded execution periods)
CREATE TABLE IF NOT EXISTS public.dev_sessions (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES public.dev_issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent TEXT NOT NULL DEFAULT 'gemini',
  model TEXT,
  status TEXT NOT NULL DEFAULT 'connected',
  repository TEXT,
  branch TEXT,
  environment JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dev_sessions_issue ON public.dev_sessions(issue_id);
CREATE INDEX IF NOT EXISTS idx_dev_sessions_user ON public.dev_sessions(user_id);

-- 3. Dev Events (Append-only durable event stream with structured evidence)
CREATE TABLE IF NOT EXISTS public.dev_events (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES public.dev_issues(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES public.dev_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_events_issue ON public.dev_events(issue_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_dev_events_session ON public.dev_events(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_dev_events_type ON public.dev_events(type);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.dev_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Authenticated Users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dev_issues' AND policyname = 'Users can manage their own dev issues') THEN
    CREATE POLICY "Users can manage their own dev issues"
      ON public.dev_issues FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dev_sessions' AND policyname = 'Users can manage their own dev sessions') THEN
    CREATE POLICY "Users can manage their own dev sessions"
      ON public.dev_sessions FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dev_events' AND policyname = 'Users can manage their own dev events') THEN
    CREATE POLICY "Users can manage their own dev events"
      ON public.dev_events FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
