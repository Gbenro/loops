-- 1. Create relational_memories table for Luna's provisional relational attunement
CREATE TABLE IF NOT EXISTS public.relational_memories (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  statement text NOT NULL,
  type text NOT NULL CHECK (type IN ('language', 'interaction_preference', 'living_distinction', 'orientation')),
  evidence_record_ids text[] DEFAULT '{}'::text[],
  confidence numeric DEFAULT 0.70 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  strength integer DEFAULT 1,
  first_seen_at timestamptz DEFAULT now() NOT NULL,
  last_seen_at timestamptz DEFAULT now() NOT NULL,
  lifecycle_status text DEFAULT 'candidate' CHECK (lifecycle_status IN ('candidate', 'emerging', 'active', 'quiet', 'dormant', 'resurfaced', 'dismissed')),
  provenance text DEFAULT 'observed' CHECK (provenance IN ('explicit', 'observed', 'co_created')),
  user_action_status text DEFAULT 'active' CHECK (user_action_status IN ('active', 'dismissed', 'pinned', 'corrected')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Indexes for efficient user retrieval
CREATE INDEX IF NOT EXISTS idx_relational_memories_user_lifecycle ON public.relational_memories(user_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_relational_memories_user_type ON public.relational_memories(user_id, type);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.relational_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own relational memories" ON public.relational_memories;
CREATE POLICY "Users can manage own relational memories"
  ON public.relational_memories
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
