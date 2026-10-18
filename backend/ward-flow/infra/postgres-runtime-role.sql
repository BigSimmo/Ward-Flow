-- Administrator-only portable PostgreSQL setup; no credentials are embedded.
-- Set wardflow_backend's password privately after this role exists.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wardflow_backend'
    AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit OR NOT rolcanlogin)) THEN
    RAISE EXCEPTION 'Runtime role flags are unsafe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wardflow_backend') THEN
    CREATE ROLE wardflow_backend LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member='wardflow_backend'::regrole
    OR (m.roleid='wardflow_backend'::regrole AND (COALESCE((to_jsonb(m)->>'set_option')::boolean, true)
      OR COALESCE((to_jsonb(m)->>'inherit_option')::boolean, true))))
    OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner='wardflow_backend'::regrole)
    OR EXISTS (SELECT 1 FROM pg_class WHERE relowner='wardflow_backend'::regrole)
    OR EXISTS (SELECT 1 FROM pg_proc WHERE proowner='wardflow_backend'::regrole)
    OR EXISTS (SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba='wardflow_backend'::regrole) THEN
    RAISE EXCEPTION 'Runtime role has unexpected membership or ownership';
  END IF;
END $$;
-- Explicit column grants are separate from table grants; revoke them on the
-- preflight-verified application objects before installing the narrow grants.
DO $$ DECLARE column_grant record; browser_role text; BEGIN
  FOR column_grant IN
    SELECT c.relname, a.attname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE n.nspname='ward_flow' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
  LOOP
    EXECUTE format('REVOKE ALL (%I) ON TABLE ward_flow.%I FROM PUBLIC, wardflow_backend', column_grant.attname, column_grant.relname);
    FOR browser_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
      EXECUTE format('REVOKE ALL (%I) ON TABLE ward_flow.%I FROM %I', column_grant.attname, column_grant.relname, browser_role);
    END LOOP;
  END LOOP;
END $$;
REVOKE ALL ON SCHEMA ward_flow FROM PUBLIC, wardflow_backend;
-- PostgreSQL 14 and earlier grant CREATE on the public schema to PUBLIC.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='public') THEN
    REVOKE CREATE ON SCHEMA public FROM PUBLIC, wardflow_backend;
  END IF;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA ward_flow FROM PUBLIC, wardflow_backend;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA ward_flow FROM PUBLIC, wardflow_backend;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ward_flow FROM PUBLIC, wardflow_backend;
-- Browser roles are optional on ordinary PostgreSQL installations.
DO $$ DECLARE browser_role text; BEGIN
  FOR browser_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    EXECUTE format('REVOKE ALL ON SCHEMA ward_flow FROM %I', browser_role);
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA ward_flow FROM %I', browser_role);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA ward_flow FROM %I', browser_role);
    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ward_flow FROM %I', browser_role);
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA ward_flow TO wardflow_backend;
GRANT SELECT ON ward_flow.migrations TO wardflow_backend;
GRANT SELECT, INSERT, UPDATE ON ward_flow.workspaces TO wardflow_backend;
GRANT SELECT, INSERT ON ward_flow.commands, ward_flow.audit TO wardflow_backend;
GRANT USAGE, SELECT ON SEQUENCE ward_flow.audit_sequence_seq TO wardflow_backend;
GRANT SELECT, INSERT, UPDATE ON ward_flow.push_baselines TO wardflow_backend;
GRANT SELECT, INSERT, UPDATE, DELETE ON ward_flow.push_subscriptions, ward_flow.push_deliveries TO wardflow_backend;
GRANT USAGE, SELECT ON SEQUENCE ward_flow.push_subscriptions_id_seq TO wardflow_backend;
-- Role access (migration 8): memberships are read, granted, approved and ended, and nothing else
-- about a granted role can change; break glass rows are only added. Skipped on a database still at
-- 5 to 7, so these grants can be re-run before 008 is applied; run them again after it.
DO $$ BEGIN
  IF to_regclass('ward_flow.memberships') IS NOT NULL THEN
    REVOKE UPDATE ON ward_flow.memberships FROM wardflow_backend;
    GRANT SELECT, INSERT ON ward_flow.memberships TO wardflow_backend;
    GRANT UPDATE (approved_by, approved_at, revoked_by, revoked_at) ON ward_flow.memberships TO wardflow_backend;
    GRANT SELECT, INSERT ON ward_flow.break_glass TO wardflow_backend;
    GRANT USAGE, SELECT ON SEQUENCE ward_flow.break_glass_id_seq TO wardflow_backend;
  END IF;
  -- Migration 9: when each role was last used, and requests for access, which are added and
  -- answered once.
  IF to_regclass('ward_flow.access_requests') IS NOT NULL THEN
    GRANT UPDATE (last_used_at) ON ward_flow.memberships TO wardflow_backend;
    GRANT SELECT, INSERT ON ward_flow.access_requests TO wardflow_backend;
    GRANT UPDATE (decision, decided_by, decided_at) ON ward_flow.access_requests TO wardflow_backend;
  END IF;
  -- Migration 10: each record of the workspace is its own row, added, rewritten and removed.
  IF to_regclass('ward_flow.workspace_records') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ward_flow.workspace_records TO wardflow_backend;
  END IF;
  -- Migration 11: record access rows are only added and read. A sign-out row is added, read, and
  -- removed once the token it refuses would have expired anyway.
  IF to_regclass('ward_flow.record_access') IS NOT NULL THEN
    GRANT SELECT, INSERT ON ward_flow.record_access TO wardflow_backend;
    GRANT USAGE, SELECT ON SEQUENCE ward_flow.record_access_id_seq TO wardflow_backend;
    GRANT SELECT, INSERT, DELETE ON ward_flow.session_sign_outs TO wardflow_backend;
  END IF;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA ward_flow REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA ward_flow REVOKE ALL ON SEQUENCES FROM PUBLIC;
DO $$ DECLARE browser_role text; BEGIN
  FOR browser_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA ward_flow REVOKE ALL ON TABLES FROM %I', browser_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA ward_flow REVOKE ALL ON SEQUENCES FROM %I', browser_role);
  END LOOP;
END $$;
ALTER ROLE wardflow_backend SET statement_timeout = '10s';
ALTER ROLE wardflow_backend SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE wardflow_backend SET lock_timeout = '5s';
