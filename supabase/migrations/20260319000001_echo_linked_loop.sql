-- Link echoes to loops
ALTER TABLE echoes ADD COLUMN IF NOT EXISTS linked_loop_id text REFERENCES loops(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS echoes_linked_loop_id_idx ON echoes(linked_loop_id);
