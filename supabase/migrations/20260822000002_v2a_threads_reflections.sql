-- Luna Loops - V2A Threads and Reflections database schemas
-- Configures the Threads, Echo-Threads many-to-many junction, and Echo Reflections tables with full Row Level Security (RLS) active.

-- 1. Threads Table
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

-- RLS policies for Threads
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own threads" 
  ON public.threads FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- 2. Echo-Threads Junction (Many-to-many association)
CREATE TABLE IF NOT EXISTS public.echo_threads (
  echo_id text REFERENCES public.echoes(id) ON DELETE CASCADE,
  thread_id text REFERENCES public.threads(id) ON DELETE CASCADE,
  created_by text DEFAULT 'user' CHECK (created_by IN ('user', 'ai')),
  relationship_type text,
  note text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (echo_id, thread_id)
);

-- RLS policies for Echo-Threads
ALTER TABLE public.echo_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own echo_threads links" 
  ON public.echo_threads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );

-- 3. Echo Reflections (Insights over time)
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

-- RLS policies for Echo Reflections
ALTER TABLE public.echo_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own echo_reflections" 
  ON public.echo_reflections FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);
