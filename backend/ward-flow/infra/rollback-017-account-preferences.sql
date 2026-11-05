-- Undo migration 017. Run as the migration administrator in one transaction, for example
-- psql "$WARD_SUPABASE_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback-017-account-preferences.sql
-- Drops each account's Help memory: tours done, tips seen, tips off and What's new read. They are
-- desk role ids, static Help topic ids and What's new entry ids only, so nothing clinical is lost,
-- but Help may show its tours and tips once more on each device. The backend accepts versions 5 to
-- the latest (see migrations.mjs), so it keeps working; before 17 each browser keeps its own memory.
-- Refuses unless the database is at exactly 17.
-- Takes migrate()'s lock first, so a migration running at the same moment cannot slip in.
SELECT pg_advisory_xact_lock(782322);
DO $$ BEGIN
  IF (SELECT max(version) FROM ward_flow.migrations) IS DISTINCT FROM 17 THEN
    RAISE EXCEPTION 'Nothing to undo: the database is not at migration 17';
  END IF;
END $$;
DROP TABLE ward_flow.account_preferences;
DELETE FROM ward_flow.migrations WHERE version = 17;
