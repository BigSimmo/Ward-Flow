-- Undo migration 010. Run as the migration administrator in one transaction, for example
-- psql "$WARD_SUPABASE_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback-010-workspace-records.sql
-- Puts every workspace's rows back into its workspace row, in their saved order, then removes the
-- rows table. Nothing is lost: the per-record and per-field revisions are the only thing that goes,
-- and the backend before 10 does not use them. The backend accepts versions 5 to the latest
-- (see migrations.mjs), so it keeps working.
-- Refuses unless the database is at exactly 10.
-- Takes migrate()'s lock first, so a migration running at the same moment cannot slip in.
SELECT pg_advisory_xact_lock(782322);
DO $$ BEGIN
  IF (SELECT max(version) FROM ward_flow.migrations) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'Nothing to undo: the database is not at migration 10';
  END IF;
END $$;
-- Holds every workspace row, so no save can commit between the read and the rewrite.
SELECT id FROM ward_flow.workspaces FOR UPDATE;
UPDATE ward_flow.workspaces w SET payload = jsonb_set(w.payload - '$revisions', '{state}', (
  SELECT jsonb_object_agg(field.key, CASE
    WHEN field.value->>'$records' = 'entry' THEN (
      SELECT coalesce(jsonb_object_agg(r.record_id, r.body), '{}'::jsonb) FROM ward_flow.workspace_records r
      WHERE r.workspace_id = w.id AND r.collection = field.key AND r.kind = 'entry')
    WHEN field.value->>'$records' IN ('item', 'index') THEN (
      SELECT coalesce(jsonb_agg(r.body ORDER BY r.ordinal), '[]'::jsonb) FROM ward_flow.workspace_records r
      WHERE r.workspace_id = w.id AND r.collection = field.key AND r.kind = field.value->>'$records')
    ELSE field.value END)
  FROM jsonb_each(w.payload->'state') AS field
))
WHERE jsonb_typeof(w.payload->'state') = 'object' AND w.payload->'state' <> '{}'::jsonb;
DROP TABLE ward_flow.workspace_records;
DELETE FROM ward_flow.migrations WHERE version = 10;
