-- 009: When the responder accepted the assignment.

ALTER TABLE incident_assignments ADD COLUMN accepted_at TIMESTAMPTZ;

-- Assignments that already started responding were accepted at that moment.
UPDATE incident_assignments SET accepted_at = responding_at
WHERE accepted_at IS NULL AND responding_at IS NOT NULL;

-- ACCEPTED assignments are active too: a responder still can't be actively
-- assigned to the same incident twice.
DROP INDEX incident_assignments_active_key;
CREATE UNIQUE INDEX incident_assignments_active_key
  ON incident_assignments (incident_id, responder_id)
  WHERE status IN ('ASSIGNED', 'ACCEPTED', 'RESPONDING');
