-- ==============================================================================
-- Targeted Data-Integrity Migration: Correct Provenance for Audited Reflection
-- Record: e1788023278172dkgq
-- Rationale: This record was created as a conversational reflection ("CONVERSATION REFLECTION — ...")
-- but was misclassified with provenance 'user'/'original_echo' by the unhardened createEcho pathway.
-- This migration updates only the provenance metadata, leaving user content strictly immutable.
-- ==============================================================================

UPDATE public.echoes
SET 
  provenance_author = 'co-created',
  provenance_kind = 'conversation_reflection',
  source = 'luna_conversation'
WHERE id = 'e1788023278172dkgq'
  AND (provenance_kind IS DISTINCT FROM 'conversation_reflection' OR provenance_author IS DISTINCT FROM 'co-created');
