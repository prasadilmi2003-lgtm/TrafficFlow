-- 013: Change incidents.reported_by FK from ON DELETE RESTRICT to ON DELETE NO ACTION.
--
-- RESTRICT raises PostgreSQL error code 23001 (restrict_violation) because it
-- is checked immediately within the triggering statement.  NO ACTION (the SQL
-- standard default) is checked at the end of the statement and raises code
-- 23503 (foreign_key_violation), which is what the specification and the
-- integration test expect when an attempt is made to delete a user who has
-- reported incidents.
--
-- The protective behaviour is identical: the DELETE is still rejected.  Only
-- the error code and timing differ.

ALTER TABLE incidents
  DROP CONSTRAINT incidents_reported_by_fkey,
  ADD CONSTRAINT incidents_reported_by_fkey
    FOREIGN KEY (reported_by) REFERENCES users (id) ON DELETE NO ACTION;
