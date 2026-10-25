-- Undo migration 012. Run as the migration administrator in one transaction, for example
-- psql "$WARD_SUPABASE_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback-012-foreign-key-indexes.sql
-- Drops the 13 foreign key indexes. No data is lost; deletes on the referenced rows get slower
-- again. The backend accepts versions 5 to the latest (see migrations.mjs), so it keeps working.
-- Refuses unless the database is at exactly 12. Takes migrate()'s lock first, so a migration running
-- at the same moment cannot slip in.
SELECT pg_advisory_xact_lock(782322);
DO $$ BEGIN
  IF (SELECT max(version) FROM ward_flow.migrations) IS DISTINCT FROM 12 THEN
    RAISE EXCEPTION 'Nothing to undo: the database is not at migration 12';
  END IF;
END $$;
DROP INDEX ward_flow.access_requests_workspace_mode;
DROP INDEX ward_flow.audit_workspace_mode;
DROP INDEX ward_flow.break_glass_membership;
DROP INDEX ward_flow.break_glass_workspace_mode;
DROP INDEX ward_flow.commands_workspace_mode;
DROP INDEX ward_flow.memberships_workspace_mode;
DROP INDEX ward_flow.push_baselines_workspace_mode;
DROP INDEX ward_flow.push_subscriptions_membership;
DROP INDEX ward_flow.push_subscriptions_workspace_mode;
DROP INDEX ward_flow.record_access_membership;
DROP INDEX ward_flow.record_access_workspace_mode;
DROP INDEX ward_flow.session_sign_outs_workspace_mode;
DROP INDEX ward_flow.workspace_records_workspace_mode;
DELETE FROM ward_flow.migrations WHERE version = 12;
