-- Undo migration 011. Run as the migration administrator in one transaction, for example
-- psql "$WARD_SUPABASE_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback-011-record-access-and-sign-out.sql
-- Removes the record access log, the edit block on break glass rows and server-side sign-outs.
-- The record access log is the "who opened which record" history: export it first if it must be
-- kept, because dropping the table deletes it. The backend accepts versions 5 to the latest (see
-- migrations.mjs), so it keeps working; before 11 opening a record is not logged and a sign-out ends the sign-in only when its
-- token expires. Refuses unless the database is at exactly 11.
-- Takes migrate()'s lock first, so a migration running at the same moment cannot slip in.
SELECT pg_advisory_xact_lock(782322);
DO $$ BEGIN
  IF (SELECT max(version) FROM ward_flow.migrations) IS DISTINCT FROM 11 THEN
    RAISE EXCEPTION 'Nothing to undo: the database is not at migration 11';
  END IF;
END $$;
DROP TABLE ward_flow.session_sign_outs;
DROP TABLE ward_flow.record_access;
DROP FUNCTION ward_flow.protect_record_access();
DROP TRIGGER protect_break_glass ON ward_flow.break_glass;
DROP FUNCTION ward_flow.protect_break_glass();
DELETE FROM ward_flow.migrations WHERE version = 11;
