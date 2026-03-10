-- Fix infinite recursion in allowed_emails RLS policies.
-- All admin policies were querying allowed_emails while evaluating
-- a policy ON allowed_emails → PostgreSQL infinite recursion error.
-- Solution: SECURITY DEFINER function that bypasses RLS entirely.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM allowed_emails
    WHERE lower(email) = lower(auth.email()) AND role = 'admin'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Drop and recreate all policies using is_admin() instead of self-referencing subqueries

DROP POLICY IF EXISTS "admin read all" ON allowed_emails;
DROP POLICY IF EXISTS "admin insert" ON allowed_emails;
DROP POLICY IF EXISTS "admin delete" ON allowed_emails;
DROP POLICY IF EXISTS "admin read feedback" ON feedback;

CREATE POLICY "admin read all"
  ON allowed_emails FOR SELECT
  USING (is_admin());

CREATE POLICY "admin insert"
  ON allowed_emails FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "admin delete"
  ON allowed_emails FOR DELETE
  USING (is_admin());

CREATE POLICY "admin read feedback"
  ON feedback FOR SELECT
  USING (is_admin());
