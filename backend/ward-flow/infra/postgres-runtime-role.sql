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
  IF EXISTS (SELECT 1 FROM pg_auth_members WHERE member='wardflow_backend'::regrole)
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
