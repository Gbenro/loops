-- SECURITY DEFINER function to check beta access without RLS complications
CREATE OR REPLACE FUNCTION check_my_access()
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM allowed_emails
  WHERE lower(email) = lower(auth.email());
  RETURN v_role; -- NULL if not found
END;
$$;

GRANT EXECUTE ON FUNCTION check_my_access() TO authenticated;
