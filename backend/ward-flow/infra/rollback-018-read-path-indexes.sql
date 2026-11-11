-- Undo migration 018. Run as the migration administrator in one transaction, for example
-- psql "$WARD_SUPABASE_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback-018-read-path-indexes.sql
-- Drops the three read-path indexes. No data is lost; the break glass check, the access history
-- and the record access list get slower again. The backend accepts versions 5 to the latest (see
-- migrations.mjs), so it keeps working. Refuses unless the database is at exactly 18. Takes
-- migrate()'s lock first, so a migration running at the same moment cannot slip in.
SELECT pg_advisory_xact_lock(782322);
DO $$ BEGIN
  IF (SELECT max(version) FROM ward_flow.migrations) IS DISTINCT FROM 18 THEN
    RAISE EXCEPTION 'Nothing to undo: the database is not at migration 18';
  END IF;
END $$;
DROP INDEX ward_flow.audit_break_glass_actor;
DROP INDEX ward_flow.audit_access_sequence;
DROP INDEX ward_flow.record_access_workspace_viewed;
DELETE FROM ward_flow.migrations WHERE version = 18;
