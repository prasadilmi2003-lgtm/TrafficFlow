-- 011: The severity an incident type usually has. Operators start from it
-- when they verify a report; they can always choose another one.

ALTER TABLE incident_types ADD COLUMN default_severity incident_severity;

UPDATE incident_types SET default_severity = defaults.severity::incident_severity
FROM (VALUES
  ('ACCIDENT',   'HIGH'),
  ('BREAKDOWN',  'LOW'),
  ('ROAD_BLOCK', 'MEDIUM'),
  ('FLOODING',   'HIGH'),
  ('FIRE',       'CRITICAL'),
  ('HAZARD',     'MEDIUM')
) AS defaults (code, severity)
WHERE incident_types.code = defaults.code AND incident_types.default_severity IS NULL;
