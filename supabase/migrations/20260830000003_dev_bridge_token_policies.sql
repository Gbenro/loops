-- ============================================================================
-- Migration: 20260830000003_dev_bridge_token_policies.sql
-- Description: Postgres RLS policies for scoped ephemeral Dev Session tokens
-- ============================================================================

-- 1. Ensure columns exist on dev_sessions
ALTER TABLE public.dev_sessions
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dev_sessions_token ON public.dev_sessions(token);

-- 2. Allow session lookup and activity update by active token
DROP POLICY IF EXISTS "Allow token validation on dev_sessions" ON public.dev_sessions;
CREATE POLICY "Allow token validation on dev_sessions"
  ON public.dev_sessions FOR SELECT
  TO anon
  USING (token IS NOT NULL AND status = 'connected');

DROP POLICY IF EXISTS "Allow token update on dev_sessions" ON public.dev_sessions;
CREATE POLICY "Allow token update on dev_sessions"
  ON public.dev_sessions FOR UPDATE
  TO anon
  USING (token IS NOT NULL AND status = 'connected')
  WITH CHECK (token IS NOT NULL);

-- 3. Allow reading dev_issues only when an active authorized dev session exists
DROP POLICY IF EXISTS "Allow dev session issue read" ON public.dev_issues;
CREATE POLICY "Allow dev session issue read"
  ON public.dev_issues FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.dev_sessions s
      WHERE s.issue_id = dev_issues.id
        AND s.token IS NOT NULL
        AND s.status = 'connected'
        AND s.token_expires_at > now()
    )
  );

-- 4. Allow reading & inserting dev_events only for the active authorized session
DROP POLICY IF EXISTS "Allow dev session events read" ON public.dev_events;
CREATE POLICY "Allow dev session events read"
  ON public.dev_events FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.dev_sessions s
      WHERE s.id = dev_events.session_id
        AND s.token IS NOT NULL
        AND s.status = 'connected'
        AND s.token_expires_at > now()
    )
  );

DROP POLICY IF EXISTS "Allow dev session events insert" ON public.dev_events;
CREATE POLICY "Allow dev session events insert"
  ON public.dev_events FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dev_sessions s
      WHERE s.id = dev_events.session_id
        AND s.token IS NOT NULL
        AND s.status = 'connected'
        AND s.token_expires_at > now()
    )
  );
