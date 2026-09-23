-- 001: Enum types and shared functions used by the later migrations.

CREATE TYPE user_role AS ENUM ('CITIZEN', 'OPERATOR', 'RESPONDER', 'ADMIN');

CREATE TYPE incident_status AS ENUM (
  'REPORTED', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'RESPONDING', 'RESOLVED'
);

CREATE TYPE incident_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE assignment_status AS ENUM ('ASSIGNED', 'RESPONDING', 'COMPLETED', 'CANCELLED');

CREATE TYPE responder_type AS ENUM ('POLICE', 'AMBULANCE', 'FIRE', 'TOW', 'ROAD_MAINTENANCE');

CREATE TYPE responder_availability AS ENUM ('AVAILABLE', 'BUSY', 'OFF_DUTY');

-- Keeps updated_at current. Attached to tables with a BEFORE UPDATE trigger.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
