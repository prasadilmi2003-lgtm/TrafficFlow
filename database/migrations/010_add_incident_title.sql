-- 010: A short title for every incident, e.g. "Two-car collision at Kollupitiya
-- junction", shown in queues, lists and on the map.

ALTER TABLE incidents ADD COLUMN title VARCHAR(120);

-- Incidents reported before titles existed get one from their type and place.
UPDATE incidents i
SET title = left(t.name || COALESCE(' at ' || NULLIF(trim(i.location_text), ''), ''), 120)
FROM incident_types t
WHERE t.id = i.incident_type_id AND i.title IS NULL;

ALTER TABLE incidents
  ALTER COLUMN title SET NOT NULL,
  ADD CONSTRAINT incidents_title_not_blank CHECK (length(trim(title)) > 0);
