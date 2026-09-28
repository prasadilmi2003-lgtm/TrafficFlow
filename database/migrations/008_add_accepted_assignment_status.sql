-- 008: Responders accept an assignment before they start responding:
--   ASSIGNED -> ACCEPTED -> RESPONDING -> COMPLETED (or CANCELLED)
--
-- This file only adds the enum value. PostgreSQL does not allow a new enum
-- value to be used in the same transaction that adds it, and every
-- migration file runs in its own transaction, so 009 uses it.
ALTER TYPE assignment_status ADD VALUE IF NOT EXISTS 'ACCEPTED' BEFORE 'RESPONDING';
