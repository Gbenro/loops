-- Luna Loops - Echo Audio Storage
-- Creates private Supabase Storage bucket for voice recordings
-- and adds audio_path column to echoes table

-- ─── 1. Storage bucket ───────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'echo-audio',
  'echo-audio',
  false,
  10485760,  -- 10 MB per file
  ARRAY['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg', 'audio/mpeg']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. RLS policies for storage ─────────────────────────────────────────────

-- Users can upload audio to their own folder only
CREATE POLICY "Users can upload their own audio"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'echo-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can read their own audio only
CREATE POLICY "Users can read their own audio"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'echo-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own audio only
CREATE POLICY "Users can delete their own audio"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'echo-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ─── 3. Add audio_path column to echoes ──────────────────────────────────────
-- Stores the storage path (userId/echoId.webm) so we can fetch/delete the file

ALTER TABLE echoes ADD COLUMN IF NOT EXISTS audio_path text;
