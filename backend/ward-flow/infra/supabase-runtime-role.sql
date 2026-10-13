-- Apply as the migration administrator after inspecting the actual Ward Flow schema.
-- The generated runtime password is installed separately through private setup.
-- This role is never a migration administrator or browser/PostgREST role.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'wardflow_backend'
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit OR NOT rolcanlogin)
  ) THEN
    RAISE EXCEPTION 'Runtime role flags are unsafe; inspect before applying grants';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wardflow_backend') THEN
    CREATE ROLE wardflow_backend LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_auth_members WHERE member = 'wardflow_backend'::regrole) THEN
    RAISE EXCEPTION 'Runtime role has unexpected membership; inspect before applying grants';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner = 'wardflow_backend'::regrole)
    OR EXISTS (SELECT 1 FROM pg_class WHERE relowner = 'wardflow_backend'::regrole) THEN
    RAISE EXCEPTION 'Runtime role owns database objects; inspect before applying grants';
  END IF;
END $$;
DO $$ DECLARE column_grant record; browser_role text; BEGIN
  FOR column_grant IN
    SELECT c.relname, a.attname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE n.nspname='ward_flow' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
  LOOP
    FOR browser_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
      EXECUTE format('REVOKE ALL (%I) ON TABLE ward_flow.%I FROM %I', column_grant.attname, column_grant.relname, browser_role);
    END LOOP;
  END LOOP;
END $$;
REVOKE ALL ON SCHEMA ward_flow FROM PUBLIC, anon, authenticated, wardflow_backend;
REVOKE ALL ON ALL TABLES IN SCHEMA ward_flow FROM PUBLIC, anon, authenticated, wardflow_backend;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA ward_flow FROM PUBLIC, anon, authenticated, wardflow_backend;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ward_flow FROM PUBLIC, anon, authenticated, wardflow_backend;
GRANT USAGE ON SCHEMA ward_flow TO wardflow_backend;
GRANT SELECT ON ward_flow.migrations TO wardflow_backend;
GRANT SELECT, INSERT, UPDATE ON ward_flow.workspaces TO wardflow_backend;
GRANT SELECT, INSERT ON ward_flow.commands, ward_flow.audit TO wardflow_backend;
GRANT USAGE, SELECT ON SEQUENCE ward_flow.audit_sequence_seq TO wardflow_backend;
-- Phone push remains off by default; its existing store needs these narrower grants if enabled.
GRANT SELECT, INSERT, UPDATE ON ward_flow.push_baselines TO wardflow_backend;
GRANT SELECT, INSERT, UPDATE, DELETE ON ward_flow.push_subscriptions, ward_flow.push_deliveries TO wardflow_backend;
GRANT USAGE, SELECT ON SEQUENCE ward_flow.push_subscriptions_id_seq TO wardflow_backend;
-- Remove explicit per-schema browser defaults for future tables/sequences.
-- After each migration repeat the explicit REVOKE ALL ON ALL FUNCTIONS above and
-- verify browser schema USAGE stays denied. A per-schema function default REVOKE
-- cannot cancel PostgreSQL's global PUBLIC EXECUTE default; no global change is made here.
ALTER DEFAULT PRIVILEGES IN SCHEMA ward_flow REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA ward_flow REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
