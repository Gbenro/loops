-- Luna Loops - Complete Initial Database Setup Schema
-- Run this single script in the Supabase SQL Editor on a brand new project to configure all tables, functions, RLS policies, and storage buckets.

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamptz,
  sun_sign text,
  moon_sign text,
  rising_sign text,
  hemisphere text DEFAULT 'north',
  latitude double precision,
  longitude double precision,
  timezone text,
  encryption_verify_token text
);

-- 2. Loops Table
CREATE TABLE IF NOT EXISTS public.loops (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text DEFAULT 'phase',
  status text DEFAULT 'active',
  color text DEFAULT '#A78BFA',
  subtasks jsonb DEFAULT '[]'::jsonb,
  linked_to text,
  phase_opened text,
  phase_name text,
  lunar_month_opened text,
  moon_age_opened float,
  zodiac_opened text,
  window_end timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  released_at timestamptz,
  phase_closed text,
  phase_name_closed text,
  lunar_month_closed text,
  note text,
  auto_closed_reason text,
  focus text CHECK (focus IN ('ongoing', 'paused')),
  deleted_at timestamptz,
  is_encrypted boolean DEFAULT false,
  description text,
  source text DEFAULT 'manual',
  source_conversation_id text,
  source_excerpt text,
  source_reference text,
  energy_state text,
  attention_level text,
  aliveness_score integer,
  parent_loop_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  tags jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3. Echoes / Journal Entries Table
CREATE TABLE IF NOT EXISTS public.echoes (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL,
  source text DEFAULT 'text',
  phase text,
  phase_name text,
  phase_type text,
  lunar_month text,
  day_of_cycle integer,
  zodiac text,
  illumination integer,
  is_encrypted boolean DEFAULT false,
  audio_path text,
  tags jsonb DEFAULT '[]'::jsonb,
  linked_loop_id text REFERENCES public.loops(id) ON DELETE SET NULL,
  loop_ids jsonb DEFAULT '[]'::jsonb,
  deleted_at timestamptz,
  source_conversation_id text,
  source_excerpt text,
  source_reference text,
  energy_state text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS echoes_linked_loop_id_idx ON public.echoes(linked_loop_id);

-- 4. Feedback Table
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. Allowed Emails (Beta access)
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  email text PRIMARY KEY,
  role text DEFAULT 'tester' CHECK (role IN ('tester', 'admin')),
  note text,
  added_at timestamptz DEFAULT now()
);

-- 6. Rhythms Tables
CREATE TABLE IF NOT EXISTS public.rhythms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  scope text NOT NULL check (scope in ('cycle', 'ongoing')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rhythms_user_active ON public.rhythms (user_id, active);

CREATE TABLE IF NOT EXISTS public.rhythm_cycle_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rhythm_id uuid REFERENCES public.rhythms ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_start timestamptz not null,
  intention_type text check (intention_type in ('whole', 'phase', 'none')),
  whole_intention text check (whole_intention in ('none','light','moderate','deep','ceremonial')),
  phase_intentions jsonb DEFAULT '{}',
  report_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rci_rhythm_cycle ON public.rhythm_cycle_instances (rhythm_id, cycle_start);
CREATE INDEX IF NOT EXISTS rci_user_cycle ON public.rhythm_cycle_instances (user_id, cycle_start);

CREATE TABLE IF NOT EXISTS public.rhythm_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_instance_id uuid REFERENCES public.rhythm_cycle_instances ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  phase text not null check (phase in (
    'new','waxing-crescent','first-quarter','waxing-gibbous',
    'full','waning-gibbous','last-quarter','waning-crescent'
  )),
  engagement text not null check (engagement in
    ('none','light','moderate','deep','ceremonial')),
  note text,
  logged_at timestamptz DEFAULT now(),
  date_key text,
  day_in_phase integer,
  unique (cycle_instance_id, phase, date_key)
);

CREATE INDEX IF NOT EXISTS ro_instance ON public.rhythm_observations (cycle_instance_id);
CREATE INDEX IF NOT EXISTS ro_date_key ON public.rhythm_observations (date_key);

-- 7. Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE lower(email) = lower(auth.email()) AND role = 'admin'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_my_access()
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM public.allowed_emails
  WHERE lower(email) = lower(auth.email());
  RETURN v_role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_my_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_stats()
RETURNS TABLE (
  email text,
  joined_at timestamptz,
  last_seen timestamptz,
  loop_count bigint,
  echo_count bigint,
  feedback_count bigint,
  role text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.allowed_emails ae
    WHERE lower(ae.email) = lower(auth.email()) AND ae.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    u.email::text,
    u.created_at AS joined_at,
    u.last_sign_in_at AS last_seen,
    COALESCE((SELECT COUNT(*) FROM public.loops l WHERE l.user_id = u.id AND l.deleted_at IS NULL), 0) AS loop_count,
    COALESCE((SELECT COUNT(*) FROM public.echoes e WHERE e.user_id = u.id AND e.deleted_at IS NULL), 0) AS echo_count,
    COALESCE((SELECT COUNT(*) FROM public.feedback f WHERE f.user_id = u.id), 0) AS feedback_count,
    COALESCE((SELECT ae.role FROM public.allowed_emails ae WHERE lower(ae.email) = lower(u.email)), 'none') AS role
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

-- 8. Row Level Security (RLS) & Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own profiles" ON public.profiles FOR ALL USING (auth.uid() = id);

ALTER TABLE public.loops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own loops" ON public.loops FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.echoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own echoes" ON public.echoes FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert feedback" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "admin read feedback" ON public.feedback FOR SELECT USING (public.is_admin());

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "check own access" ON public.allowed_emails FOR SELECT USING (lower(email) = lower(auth.email()));
CREATE POLICY "admin read all" ON public.allowed_emails FOR SELECT USING (public.is_admin());
CREATE POLICY "admin insert" ON public.allowed_emails FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "admin delete" ON public.allowed_emails FOR DELETE USING (public.is_admin());

ALTER TABLE public.rhythms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rhythms" ON public.rhythms FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.rhythm_cycle_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rhythm instances" ON public.rhythm_cycle_instances FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.rhythm_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own observations" ON public.rhythm_observations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. Storage Bucket & Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'echo-audio',
  'echo-audio',
  false,
  209715200,  -- 200 MB
  ARRAY['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg', 'audio/mpeg']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'echo-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read their own audio" ON storage.objects FOR SELECT USING (bucket_id = 'echo-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own audio" ON storage.objects FOR DELETE USING (bucket_id = 'echo-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 10. Threads & Reflections (V2A)
CREATE TABLE IF NOT EXISTS public.threads (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  source text DEFAULT 'user_created' CHECK (source IN ('user_created', 'ai_suggested', 'conversation_discovered', 'system_detected')),
  confidence float,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own threads" ON public.threads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.echo_threads (
  echo_id text REFERENCES public.echoes(id) ON DELETE CASCADE,
  thread_id text REFERENCES public.threads(id) ON DELETE CASCADE,
  created_by text DEFAULT 'user' CHECK (created_by IN ('user', 'ai')),
  relationship_type text,
  note text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (echo_id, thread_id)
);

ALTER TABLE public.echo_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own echo_threads links" ON public.echo_threads FOR ALL
  USING (EXISTS (SELECT 1 FROM public.threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.echo_reflections (
  id text PRIMARY KEY,
  echo_id text REFERENCES public.echoes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  author_type text DEFAULT 'user' CHECK (author_type IN ('user', 'ai', 'co_created')),
  conversation_id text,
  lunar_context jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.echo_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own echo_reflections" ON public.echo_reflections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

