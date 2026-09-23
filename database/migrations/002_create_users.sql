-- 002: User accounts for all four roles.
-- Users are never deleted, only deactivated (is_active = false), because
-- incidents and their history refer to them.

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'CITIZEN',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_full_name_not_blank CHECK (length(trim(full_name)) > 0)
);

-- Case-insensitive unique email: A@x.com and a@x.com count as the same address
CREATE UNIQUE INDEX users_email_lower_key ON users (LOWER(email));
CREATE INDEX users_role_idx ON users (role);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
