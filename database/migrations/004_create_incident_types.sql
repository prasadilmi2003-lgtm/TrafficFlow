-- 004: Incident types. A table rather than an enum so admins can add types
-- without a code change. The default types are reference data the app needs,
-- so they are created here rather than in the demo seed.

CREATE TABLE incident_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(30) NOT NULL,
  name        VARCHAR(60) NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT incident_types_code_key UNIQUE (code),
  CONSTRAINT incident_types_code_format CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT incident_types_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE TRIGGER incident_types_set_updated_at
  BEFORE UPDATE ON incident_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO incident_types (code, name, description) VALUES
  ('ACCIDENT',   'Accident',          'A collision involving one or more vehicles'),
  ('BREAKDOWN',  'Vehicle breakdown', 'A broken-down vehicle is blocking traffic'),
  ('ROAD_BLOCK', 'Road blockage',     'The road is blocked by debris, a fallen tree or another obstruction'),
  ('FLOODING',   'Flooding',          'Water on the road makes it unsafe or impassable'),
  ('FIRE',       'Vehicle fire',      'A vehicle or roadside fire'),
  ('HAZARD',     'Road hazard',       'Potholes, oil spills, broken traffic lights or other dangers'),
  ('OTHER',      'Other',             'Anything else that affects road safety');
