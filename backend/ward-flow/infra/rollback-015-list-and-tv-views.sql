-- Undo migration 015. Run as the migration administrator in one transaction, for example
-- psql "$WARD_SUPABASE_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback-015-list-and-tv-views.sql
-- Restores the record access log's screen list from 13. The log is append-only, so this refuses
-- once a list or TV read has been logged: that history cannot be removed to fit the old check.
-- The backend accepts versions 5 to the latest (see migrations.mjs), so it keeps working; before 15
-- list and TV reads are not logged. Refuses unless the database is at exactly 15.
-- Takes migrate()'s lock first, so a migration running at the same moment cannot slip in.
SELECT pg_advisory_xact_lock(782322);
DO $$ BEGIN
  IF (SELECT max(version) FROM ward_flow.migrations) IS DISTINCT FROM 15 THEN
    RAISE EXCEPTION 'Nothing to undo: the database is not at migration 15';
  END IF;
  IF EXISTS (SELECT 1 FROM ward_flow.record_access WHERE surface IN ('list', 'tv')) THEN
    RAISE EXCEPTION 'List and TV reads are logged and cannot be removed; keep migration 15';
  END IF;
END $$;
ALTER TABLE ward_flow.record_access DROP CONSTRAINT record_access_surface_check;
ALTER TABLE ward_flow.record_access ADD CONSTRAINT record_access_surface_check CHECK (surface IN ('patient', 'movement', 'referral'));
DELETE FROM ward_flow.migrations WHERE version = 15;
