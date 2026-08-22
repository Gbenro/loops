-- Luna Loops - MCP Metadata & Lifecycle columns
-- Ensures loops and echoes can store source, conversation, parent relationships, and other rich metadata.

-- Ensure columns exist on loops table
ALTER TABLE loops ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE loops ADD COLUMN IF NOT EXISTS source_conversation_id text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS source_excerpt text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS source_reference text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS energy_state text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS attention_level text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS aliveness_score integer;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS parent_loop_id text;
ALTER TABLE loops ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Ensure columns exist on echoes table
ALTER TABLE echoes ADD COLUMN IF NOT EXISTS source_conversation_id text;
ALTER TABLE echoes ADD COLUMN IF NOT EXISTS source_excerpt text;
ALTER TABLE echoes ADD COLUMN IF NOT EXISTS source_reference text;
ALTER TABLE echoes ADD COLUMN IF NOT EXISTS energy_state text;
ALTER TABLE echoes ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
