-- Undo migration 016. Run as the migration administrator in one transaction, for example
-- psql "$WARD_SUPABASE_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback-016-forecast-history.sql
-- Drops the shared forecast history: the daily snapshots and the recorded miss reasons. They are
-- counts and closed-list values only, kept for the Statistics track record, so nothing clinical is
-- lost, but the shared track record starts again. The backend accepts versions 5 to the latest
-- (see migrations.mjs), so it keeps working; before 16 each browser keeps its own forecast history.
-- Refuses unless the database is at exactly 16.
-- Takes migrate()'s lock first, so a migration running at the same moment cannot slip in.
SELECT pg_advisory_xact_lock(782322);
DO $$ BEGIN
  IF (SELECT max(version) FROM ward_flow.migrations) IS DISTINCT FROM 16 THEN
    RAISE EXCEPTION 'Nothing to undo: the database is not at migration 16';
  END IF;
END $$;
DROP TABLE ward_flow.forecast_miss_reasons;
DROP TABLE ward_flow.forecast_snapshots;
DELETE FROM ward_flow.migrations WHERE version = 16;
