-- Runs once, when the PostgreSQL container (docker-compose.yml) starts with
-- an empty data volume. The main database (POSTGRES_DB) is created by the
-- postgres image itself.
--
-- This creates a second, separate database for the backend's integration
-- tests (TEST_DATABASE_URL in backend/.env). The tests wipe it every time
-- they run, so it must never be the real database.
CREATE DATABASE trafficflow_test;
