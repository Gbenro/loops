-- ==============================================================================
-- Targeted Data-Integrity Migration: Correct Provenance for Audited Reflection
-- Record: e1788023278172dkgq
-- Rationale: This record was created as a conversational reflection ("CONVERSATION REFLECTION — ...")
-- but was misclassified with provenance 'user'/'original_echo' by the unhardened createEcho pathway.
-- We temporarily disable the immutability trigger to correct system metadata, leaving content untouched.
-- ==============================================================================

-- 1. Temporarily disable the immutability trigger for the administrative migration
ALTER TABLE public.echoes DISABLE TRIGGER enforce_echo_immutability_trigger;

-- 2. Correct provenance metadata for the audited conversation reflection
UPDATE public.echoes
SET 
  provenance_author = 'co-created',
  provenance_kind = 'conversation_reflection',
  source = 'luna_conversation'
WHERE id = 'e1788023278172dkgq';

-- 3. Re-enable the immutability trigger immediately to protect all user echoes
ALTER TABLE public.echoes ENABLE TRIGGER enforce_echo_immutability_trigger;
