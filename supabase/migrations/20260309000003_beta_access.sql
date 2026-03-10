-- Beta access control for Luna Loops v2

CREATE TABLE IF NOT EXISTS allowed_emails (
  email text PRIMARY KEY,
  role text DEFAULT 'tester' CHECK (role IN ('tester', 'admin')),
  note text,
  added_at timestamptz DEFAULT now()
);

ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;

-- Users can check their own row
CREATE POLICY "check own access"
  ON allowed_emails FOR SELECT
  USING (lower(email) = lower(auth.email()));

-- Admins can read all rows (needed for dashboard)
CREATE POLICY "admin read all"
  ON allowed_emails FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM allowed_emails ae WHERE lower(ae.email) = lower(auth.email()) AND ae.role = 'admin')
  );

-- Admins can insert new emails
CREATE POLICY "admin insert"
  ON allowed_emails FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM allowed_emails ae WHERE lower(ae.email) = lower(auth.email()) AND ae.role = 'admin')
  );

-- Admins can delete emails
CREATE POLICY "admin delete"
  ON allowed_emails FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM allowed_emails ae WHERE lower(ae.email) = lower(auth.email()) AND ae.role = 'admin')
  );

-- Admin stats function (SECURITY DEFINER so it can access auth.users)
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS TABLE (
  email text,
  joined_at timestamptz,
  last_seen timestamptz,
  loop_count bigint,
  echo_count bigint,
  feedback_count bigint,
  role text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM allowed_emails ae
    WHERE lower(ae.email) = lower(auth.email()) AND ae.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    u.email::text,
    u.created_at AS joined_at,
    u.last_sign_in_at AS last_seen,
    COALESCE((SELECT COUNT(*) FROM loops l WHERE l.user_id = u.id AND l.deleted_at IS NULL), 0) AS loop_count,
    COALESCE((SELECT COUNT(*) FROM echoes e WHERE e.user_id = u.id AND e.deleted_at IS NULL), 0) AS echo_count,
    COALESCE((SELECT COUNT(*) FROM feedback f WHERE f.user_id = u.id), 0) AS feedback_count,
    COALESCE((SELECT ae.role FROM allowed_emails ae WHERE lower(ae.email) = lower(u.email)), 'none') AS role
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

-- Admin feedback read policy
CREATE POLICY "admin read feedback"
  ON feedback FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM allowed_emails ae WHERE lower(ae.email) = lower(auth.email()) AND ae.role = 'admin')
  );
