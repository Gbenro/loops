-- ============================================================================
-- Migration: 20260919000001_dev_assets_schema.sql
-- Description: Creative Asset Bridge V1 - Bidirectional Luna <-> Gemini Production Assets
-- Tables: dev_assets
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dev_assets (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  video_id TEXT,
  shot_id TEXT NOT NULL,
  batch INTEGER,
  kind TEXT NOT NULL DEFAULT 'image',
  role TEXT NOT NULL DEFAULT 'source',
  generated_by TEXT NOT NULL DEFAULT 'gemini',
  status TEXT NOT NULL DEFAULT 'approved',
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  width INTEGER NOT NULL DEFAULT 1080,
  height INTEGER NOT NULL DEFAULT 1920,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  filename TEXT NOT NULL,
  checksum TEXT,
  prompt TEXT,
  motion_intent TEXT,
  data_base64 TEXT,
  ingested_locally BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_assets_user_project ON public.dev_assets(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_dev_assets_shot ON public.dev_assets(shot_id);
CREATE INDEX IF NOT EXISTS idx_dev_assets_status ON public.dev_assets(status);
CREATE INDEX IF NOT EXISTS idx_dev_assets_generated_by ON public.dev_assets(generated_by);

ALTER TABLE public.dev_assets ENABLE ROW LEVEL SECURITY;

DO 305
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dev_assets' AND policyname = 'Users can manage their own dev assets') THEN
    CREATE POLICY "Users can manage their own dev assets"
      ON public.dev_assets FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END 305;

