-- Undo migration 008. Run as the migration administrator in one transaction, for example
-- psql "$WARD_SUPABASE_MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f infra/rollback-008-role-access.sql
-- Removes every membership and break glass record, so only the WARD_COORDINATOR_USER_IDS accounts
-- can sign in afterwards. The backend accepts versions 5 to 8, so it keeps working for them.
-- Refuses unless the database is at exactly 8, and refuses once any audit row names a role other
-- than coordinator or a place narrower than statewide, because dropping actor_scope would erase it
-- and audit rows are never deleted or changed.
-- Takes migrate()'s lock first, so a migration running at the same moment cannot slip in.
SELECT pg_advisory_xact_lock(782322);
DO $$ BEGIN
  IF (SELECT max(version) FROM ward_flow.migrations) IS DISTINCT FROM 8 THEN
    RAISE EXCEPTION 'Nothing to undo: the database is not at migration 8';
  END IF;
  IF EXISTS (
    SELECT 1 FROM ward_flow.audit
    WHERE actor_role <> 'coordinator' OR (actor_scope IS NOT NULL AND actor_scope <> '{"kind": "statewide"}'::jsonb)
  ) THEN
    RAISE EXCEPTION 'Audit rows name roles or places that would be lost; they cannot be removed, so 008 stays';
  END IF;
END $$;
DROP TABLE ward_flow.break_glass;
DROP TABLE ward_flow.memberships;
ALTER TABLE ward_flow.audit DROP COLUMN actor_scope;
ALTER TABLE ward_flow.audit DROP CONSTRAINT audit_actor_role_check;
ALTER TABLE ward_flow.audit ADD CONSTRAINT audit_actor_role_check CHECK (actor_role = 'coordinator');
DELETE FROM ward_flow.migrations WHERE version = 8;
