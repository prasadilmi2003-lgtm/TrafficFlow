-- 003: Extra details for users with the RESPONDER role (one profile per responder).

CREATE TABLE responder_profiles (
  user_id        UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  responder_type responder_type NOT NULL,
  unit_code      VARCHAR(30) NOT NULL,
  availability   responder_availability NOT NULL DEFAULT 'AVAILABLE',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT responder_profiles_unit_code_not_blank CHECK (length(trim(unit_code)) > 0)
);

-- Unit codes such as AMB-07 are unique, ignoring case
CREATE UNIQUE INDEX responder_profiles_unit_code_key ON responder_profiles (UPPER(unit_code));
CREATE INDEX responder_profiles_type_availability_idx ON responder_profiles (responder_type, availability);

CREATE TRIGGER responder_profiles_set_updated_at
  BEFORE UPDATE ON responder_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
