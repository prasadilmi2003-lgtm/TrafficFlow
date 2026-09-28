-- 001: Types and shared functions used by the users table.

-- The four roles. Public registration always creates CITIZEN; the other
-- roles can only be given by the system (not by a registration request).
CREATE TYPE user_role AS ENUM ('CITIZEN', 'OPERATOR', 'RESPONDER', 'ADMIN');

-- Keeps updated_at current. Attached to tables with a BEFORE UPDATE trigger.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
