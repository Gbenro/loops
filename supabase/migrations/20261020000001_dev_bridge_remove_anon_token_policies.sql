-- PREPARED ONLY: requires explicit approval and backend rollout first.
-- Token validation now uses a server-side service client. Browser anon clients
-- must not be able to enumerate or update active session credentials.
-- Authenticated owner policies remain in place. No personal tables are changed.
DROP POLICY IF EXISTS "Allow token validation on dev_sessions" ON public.dev_sessions;
DROP POLICY IF EXISTS "Allow token update on dev_sessions" ON public.dev_sessions;
DROP POLICY IF EXISTS "Allow dev session issue read" ON public.dev_issues;
DROP POLICY IF EXISTS "Allow dev session events read" ON public.dev_events;
DROP POLICY IF EXISTS "Allow dev session events insert" ON public.dev_events;
