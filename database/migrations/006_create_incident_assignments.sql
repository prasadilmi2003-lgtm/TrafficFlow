-- 006: Links incidents to responders. One row per responder per assignment,
-- so an incident can have several responders (for example police and an
-- ambulance), and reassignments keep their history.

CREATE TABLE incident_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   UUID NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  responder_id  UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  assigned_by   UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status        assignment_status NOT NULL DEFAULT 'ASSIGNED',
  notes         TEXT,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responding_at TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A responder can't be actively assigned to the same incident twice
CREATE UNIQUE INDEX incident_assignments_active_key
  ON incident_assignments (incident_id, responder_id)
  WHERE status IN ('ASSIGNED', 'RESPONDING');

CREATE INDEX incident_assignments_responder_status_idx ON incident_assignments (responder_id, status);
CREATE INDEX incident_assignments_incident_idx ON incident_assignments (incident_id);

CREATE TRIGGER incident_assignments_set_updated_at
  BEFORE UPDATE ON incident_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
