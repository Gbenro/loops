-- ==============================================================================
-- Migration: Add 'conversation_reflection' to provenance_kind Check Constraint
-- and Targeted Data-Integrity Migration for Audited Reflection e1788023278172dkgq
-- ==============================================================================

-- 1. Expand check constraint on echoes to include 'conversation_reflection'
ALTER TABLE public.echoes DROP CONSTRAINT IF EXISTS echoes_provenance_kind_check;
ALTER TABLE public.echoes ADD CONSTRAINT echoes_provenance_kind_check 
  CHECK (provenance_kind IN ('original_echo', 'conversation_reflection', 'ai_reflection', 'checkpoint', 'product_note'));

-- 2. Expand check constraint on loops to include 'conversation_reflection'
ALTER TABLE public.loops DROP CONSTRAINT IF EXISTS loops_provenance_kind_check;
ALTER TABLE public.loops ADD CONSTRAINT loops_provenance_kind_check 
  CHECK (provenance_kind IN ('original_echo', 'conversation_reflection', 'ai_reflection', 'checkpoint', 'product_note'));

-- 3. Temporarily disable the immutability trigger for the administrative migration
ALTER TABLE public.echoes DISABLE TRIGGER enforce_echo_immutability_trigger;

-- 4. Correct provenance metadata for the audited conversation reflection
UPDATE public.echoes
SET 
  provenance_author = 'co-created',
  provenance_kind = 'conversation_reflection',
  source = 'luna_conversation'
WHERE id = 'e1788023278172dkgq';

-- 5. Re-enable the immutability trigger immediately
ALTER TABLE public.echoes ENABLE TRIGGER enforce_echo_immutability_trigger;
