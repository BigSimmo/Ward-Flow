-- Undo migration 14. Run as the migration administrator in one transaction, for example
-- psql "$WARD_SUPABASE_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback-014-archived-records.sql
-- Puts every archived record of the workspace's current world generation back into the live
-- workspace as its own record row, then removes the archive table, so no record is lost. A record
-- put back goes to the start of its list (position 0). Rows of an earlier generation were already
-- out of view and are dropped with the table. The backend accepts versions 5 to the latest (see
-- migrations.mjs), so it keeps working; before 14 nothing is archived and the live workspace grows
-- again. A workspace that relied on the archive to stay under the 8 MiB save limit is over it
-- once its records are back, and every save then fails until it is migrated to 14 again.
-- Refuses unless the database is at exactly 14.
-- Takes migrate()'s lock first, so a migration running at the same moment cannot slip in.
SELECT pg_advisory_xact_lock(782322);
DO $$ BEGIN
  IF (SELECT max(version) FROM ward_flow.migrations) IS DISTINCT FROM 14 THEN
    RAISE EXCEPTION 'Nothing to undo: the database is not at migration 14';
  END IF;
END $$;
INSERT INTO ward_flow.workspace_records(workspace_id, collection, record_id, kind, ordinal, revision, body)
SELECT a.workspace_id, a.collection, a.record_id, 'item', 0, w.revision, a.body
FROM ward_flow.archived_records a
JOIN ward_flow.workspaces w ON w.id = a.workspace_id
WHERE a.world_generation = (w.payload->'state'->>'worldGeneration')::bigint
ON CONFLICT (workspace_id, collection, record_id) DO NOTHING;
DROP TABLE ward_flow.archived_records;
DELETE FROM ward_flow.migrations WHERE version = 14;
