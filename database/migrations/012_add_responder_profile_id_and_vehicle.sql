-- 012: Responder profiles get their own id (user_id stays the primary key,
-- because each responder has exactly one profile) and details of the unit's
-- vehicle.

ALTER TABLE responder_profiles
  ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN vehicle_registration VARCHAR(20),
  ADD COLUMN vehicle_description VARCHAR(100),
  ADD CONSTRAINT responder_profiles_id_key UNIQUE (id);
