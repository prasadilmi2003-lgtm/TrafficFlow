-- 007: Every status change of every incident, and every note added while it
-- is handled: the citizen's tracking timeline and the operators' audit trail.
-- A note keeps the status unchanged (from_status = to_status). Rows are only
-- ever inserted.

CREATE TABLE incident_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  from_status incident_status,  -- NULL for the first entry (REPORTED)
  to_status   incident_status NOT NULL,
  changed_by  UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  note        TEXT,
  -- clock_timestamp() (not now()) so entries written in quick succession
  -- still sort in the order they happened
  created_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX incident_status_history_incident_idx
  ON incident_status_history (incident_id, created_at);
