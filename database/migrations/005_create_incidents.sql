-- 005: Incidents reported by citizens.

-- Readable references such as TF-000123, unique even when many reports
-- arrive at once. A failed insert can leave a gap in the numbers, which is
-- expected and harmless.
CREATE SEQUENCE incident_reference_seq;

CREATE FUNCTION next_incident_reference() RETURNS TEXT
LANGUAGE sql AS $$
  -- Pad to at least six digits without ever cutting longer numbers short
  SELECT 'TF-' || lpad(n::text, greatest(6, length(n::text)), '0')
  FROM (SELECT nextval('incident_reference_seq') AS n) AS next_value;
$$;

CREATE TABLE incidents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no     VARCHAR(20) NOT NULL DEFAULT next_incident_reference(),
  reported_by      UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  incident_type_id UUID NOT NULL REFERENCES incident_types (id) ON DELETE RESTRICT,
  description      TEXT NOT NULL,
  latitude         NUMERIC(9, 6) NOT NULL,
  longitude        NUMERIC(9, 6) NOT NULL,
  location_text    VARCHAR(255),
  image_path       VARCHAR(255),
  severity         incident_severity,
  status           incident_status NOT NULL DEFAULT 'REPORTED',
  reviewed_by      UUID REFERENCES users (id) ON DELETE RESTRICT,
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  resolved_at      TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT incidents_reference_no_key UNIQUE (reference_no),
  CONSTRAINT incidents_latitude_range CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT incidents_longitude_range CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT incidents_description_length CHECK (length(description) BETWEEN 10 AND 2000),
  CONSTRAINT incidents_rejection_reason_required
    CHECK (status <> 'REJECTED' OR rejection_reason IS NOT NULL),
  CONSTRAINT incidents_severity_after_review
    CHECK (status IN ('REPORTED', 'REJECTED') OR severity IS NOT NULL),
  CONSTRAINT incidents_resolved_at_required
    CHECK (status <> 'RESOLVED' OR resolved_at IS NOT NULL)
);

ALTER SEQUENCE incident_reference_seq OWNED BY incidents.reference_no;

CREATE INDEX incidents_status_idx ON incidents (status);
CREATE INDEX incidents_reported_by_idx ON incidents (reported_by);
CREATE INDEX incidents_type_idx ON incidents (incident_type_id);
CREATE INDEX incidents_created_at_idx ON incidents (created_at DESC);

CREATE TRIGGER incidents_set_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
