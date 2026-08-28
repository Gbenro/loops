-- 1. Backfill echoes and loops provenance columns where they are currently null
UPDATE public.echoes SET provenance_author = 'user', provenance_kind = 'original_echo' WHERE provenance_author IS NULL;
UPDATE public.loops SET provenance_author = 'user', provenance_kind = 'original_echo' WHERE provenance_author IS NULL;

-- 2. Trigger function to enforce database-level immutability of personal user echoes
CREATE OR REPLACE FUNCTION public.enforce_echo_immutability()
RETURNS TRIGGER AS $$
BEGIN
    -- If the record is a user-authored original personal Echo
    IF OLD.provenance_author = 'user' AND OLD.provenance_kind = 'original_echo' THEN
        -- Enforce text cannot change
        IF NEW.text IS DISTINCT FROM OLD.text THEN
            RAISE EXCEPTION 'Personal Echo text content is immutable and cannot be updated.';
        END IF;
        
        -- Enforce audio_path cannot change
        IF NEW.audio_path IS DISTINCT FROM OLD.audio_path THEN
            RAISE EXCEPTION 'Personal Echo audio reference is immutable and cannot be updated.';
        END IF;
        
        -- Enforce provenance cannot change
        IF NEW.provenance_author IS DISTINCT FROM OLD.provenance_author OR NEW.provenance_kind IS DISTINCT FROM OLD.provenance_kind THEN
            RAISE EXCEPTION 'Personal Echo authorship/provenance is immutable and cannot be updated.';
        END IF;
        
        -- Enforce created_at and lunar context cannot change
        IF NEW.created_at IS DISTINCT FROM OLD.created_at OR
           NEW.phase IS DISTINCT FROM OLD.phase OR
           NEW.phase_name IS DISTINCT FROM OLD.phase_name OR
           NEW.lunar_month IS DISTINCT FROM OLD.lunar_month OR
           NEW.day_of_cycle IS DISTINCT FROM OLD.day_of_cycle OR
           NEW.zodiac IS DISTINCT FROM OLD.zodiac OR
           NEW.illumination IS DISTINCT FROM OLD.illumination THEN
            RAISE EXCEPTION 'Personal Echo creation timestamp and lunar context are immutable.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Drop trigger if exists, then attach it to the echoes table
DROP TRIGGER IF EXISTS enforce_echo_immutability_trigger ON public.echoes;
CREATE TRIGGER enforce_echo_immutability_trigger
BEFORE UPDATE ON public.echoes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_echo_immutability();
