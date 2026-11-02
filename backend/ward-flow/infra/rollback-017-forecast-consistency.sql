-- Code-only rollback preparation. Run explicitly as migration administrator in one transaction.
-- Preserves forecast values and receipts; removes only per-day versions. New servers then make
-- shared history read-only until migration 17 returns. Stop older writers before changing schema.
SELECT pg_advisory_xact_lock(782322);
DO $$ BEGIN
  IF (SELECT max(version) FROM ward_flow.migrations) IS DISTINCT FROM 17 THEN
    RAISE EXCEPTION 'Nothing to undo: the database is not at migration 17';
  END IF;
END $$;
ALTER TABLE ward_flow.forecast_miss_reasons DROP COLUMN revision;
DELETE FROM ward_flow.migrations WHERE version = 17;
