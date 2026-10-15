-- Undo migration 006. Run as the migration administrator in one transaction, for example
-- psql "$WARD_SUPABASE_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback-006-row-level-security.sql
-- The backend accepts version 5 or 6, so it keeps working after either direction.
-- Refuses unless the database is at exactly 6, so running it before rollback-007 cannot leave a gap.
DO $$ BEGIN
  IF (SELECT max(version) FROM ward_flow.migrations) IS DISTINCT FROM 6 THEN
    RAISE EXCEPTION 'Roll back 007 first: the database is not at migration 6';
  END IF;
END $$;
DROP POLICY runtime_only ON ward_flow.migrations;
ALTER TABLE ward_flow.migrations DISABLE ROW LEVEL SECURITY;
DROP POLICY runtime_only ON ward_flow.workspaces;
ALTER TABLE ward_flow.workspaces DISABLE ROW LEVEL SECURITY;
DROP POLICY runtime_only ON ward_flow.commands;
ALTER TABLE ward_flow.commands DISABLE ROW LEVEL SECURITY;
DROP POLICY runtime_only ON ward_flow.audit;
ALTER TABLE ward_flow.audit DISABLE ROW LEVEL SECURITY;
DROP POLICY runtime_only ON ward_flow.push_baselines;
ALTER TABLE ward_flow.push_baselines DISABLE ROW LEVEL SECURITY;
DROP POLICY runtime_only ON ward_flow.push_subscriptions;
ALTER TABLE ward_flow.push_subscriptions DISABLE ROW LEVEL SECURITY;
DROP POLICY runtime_only ON ward_flow.push_deliveries;
ALTER TABLE ward_flow.push_deliveries DISABLE ROW LEVEL SECURITY;
DELETE FROM ward_flow.migrations WHERE version = 6;
