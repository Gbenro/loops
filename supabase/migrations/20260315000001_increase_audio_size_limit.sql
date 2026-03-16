-- Luna Loops - Increase audio file size limit
-- Raises echo-audio bucket limit from 10MB to 200MB
-- to support long voice recordings (15+ minutes)

UPDATE storage.buckets
SET file_size_limit = 209715200  -- 200 MB
WHERE id = 'echo-audio';
