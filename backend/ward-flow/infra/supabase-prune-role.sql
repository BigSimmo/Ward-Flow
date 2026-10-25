-- A login that can do one thing: remove repeat-press receipts (ward_flow.commands) older than 7
-- days. For the weekly clean-up workflow, so the powerful migration login never has to leave the
-- owner's hands (limits audit, 25 Oct 2026). Prepared, not applied: apply by hand as the migration
-- administrator, after Josh's yes, then set the login's password through private setup.
-- Undo: infra/rollback-prune-role.sql.
--
-- The role gets no rights on ward_flow at all. It may only call ward_flow_ops.prune_receipts, which
-- runs as its owner (the migration administrator, who bypasses row security as the table owner),
-- keeps the 7 days fixed and deletes at most 5,000 rows a call. The function lives outside ward_flow
-- so the backend's schema check still sees exactly the objects it expects.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'wardflow_pruner'
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit OR NOT rolcanlogin)
  ) THEN
    RAISE EXCEPTION 'Pruner role flags are unsafe; inspect before applying';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wardflow_pruner') THEN
    CREATE ROLE wardflow_pruner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
  END IF;
  -- A non-superuser creator on PostgreSQL 16+ gets an ADMIN-only membership (no SET, no INHERIT),
  -- which confers no access; any other membership does.
  IF EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = 'wardflow_pruner'::regrole
    OR (m.roleid = 'wardflow_pruner'::regrole AND (COALESCE((to_jsonb(m)->>'set_option')::boolean, true)
      OR COALESCE((to_jsonb(m)->>'inherit_option')::boolean, true)))) THEN
    RAISE EXCEPTION 'Pruner role has unexpected membership; inspect before applying';
  END IF;
END $$;
REVOKE ALL ON SCHEMA ward_flow FROM wardflow_pruner;
REVOKE ALL ON ALL TABLES IN SCHEMA ward_flow FROM wardflow_pruner;
CREATE SCHEMA IF NOT EXISTS ward_flow_ops;
REVOKE ALL ON SCHEMA ward_flow_ops FROM PUBLIC;
CREATE OR REPLACE FUNCTION ward_flow_ops.prune_receipts(batch integer DEFAULT 5000) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, ward_flow AS $$
DECLARE
  workspace uuid;
  removed integer := 0;
  step integer;
  size integer := least(greatest(coalesce(batch, 5000), 1), 5000);
BEGIN
  FOR workspace IN SELECT id FROM ward_flow.workspaces LOOP
    DELETE FROM ward_flow.commands WHERE ctid IN (
      SELECT ctid FROM ward_flow.commands
      WHERE workspace_id = workspace AND committed_at < now() - interval '7 days'
      LIMIT size - removed);
    GET DIAGNOSTICS step = ROW_COUNT;
    removed := removed + step;
    EXIT WHEN removed >= size;
  END LOOP;
  RETURN removed;
END $$;
REVOKE ALL ON FUNCTION ward_flow_ops.prune_receipts(integer) FROM PUBLIC;
GRANT USAGE ON SCHEMA ward_flow_ops TO wardflow_pruner;
GRANT EXECUTE ON FUNCTION ward_flow_ops.prune_receipts(integer) TO wardflow_pruner;
