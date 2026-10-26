-- Undo migration 013. Run as the migration administrator in one transaction, for example
-- psql "$WARD_SUPABASE_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback-013-referral-record-views.sql
-- Restores the record access log's original screen list. The log is append-only, so this refuses
-- once a referral opening has been logged: that history cannot be removed to fit the old check.
-- The backend accepts versions 5 to the latest (see migrations.mjs), so it keeps working; before 13
-- a referral opening is not logged. Refuses unless the database is at exactly 13.
-- Takes migrate()'s lock first, so a migration running at the same moment cannot slip in.
SELECT pg_advisory_xact_lock(782322);
DO $$ BEGIN
  IF (SELECT max(version) FROM ward_flow.migrations) IS DISTINCT FROM 13 THEN
    RAISE EXCEPTION 'Nothing to undo: the database is not at migration 13';
  END IF;
  IF EXISTS (SELECT 1 FROM ward_flow.record_access WHERE surface = 'referral') THEN
    RAISE EXCEPTION 'Referral openings are logged and cannot be removed; keep migration 13';
  END IF;
END $$;
ALTER TABLE ward_flow.record_access DROP CONSTRAINT record_access_surface_check;
ALTER TABLE ward_flow.record_access ADD CONSTRAINT record_access_surface_check CHECK (surface IN ('patient', 'movement'));
DELETE FROM ward_flow.migrations WHERE version = 13;
