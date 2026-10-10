-- Run only after approved private reachability and verified Entra reader mapping.
-- Metadata/constant results only; no grants, migrations or application payloads.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '2s';
SHOW transaction_read_only;
SELECT 1 AS connection_test, current_database() AS database_name,
       current_user AS database_login;
SELECT ssl, version, cipher FROM pg_catalog.pg_stat_ssl
WHERE pid = pg_backend_pid();
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
FROM pg_catalog.pg_roles WHERE rolname = current_user;
SELECT rolname AS reachable_elevated_role FROM pg_catalog.pg_roles
WHERE (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
  AND pg_has_role(current_user, oid, 'MEMBER');
SELECT has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_schema,
       has_database_privilege(current_user, current_database(), 'TEMPORARY') AS can_create_temp;
SELECT nspname AS schema_name,
       has_schema_privilege(current_user, oid, 'CREATE') AS can_create_objects
FROM pg_catalog.pg_namespace
WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema';
SELECT n.nspname AS schema_name, c.relname AS relation_name,
       c.relowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user) AS owned_by_reader,
       has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS has_write_privilege
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
ORDER BY n.nspname, c.relname;
SELECT n.nspname AS schema_name, c.relname AS table_name,
       a.attname AS column_name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS column_type
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
  AND c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY n.nspname, c.relname, a.attnum;
ROLLBACK;
