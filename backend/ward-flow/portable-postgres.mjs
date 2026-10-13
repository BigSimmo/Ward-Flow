import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { validatePortablePostgresUrl, validatePostgresConnectionString } from "./postgres-config.mjs";

export function createPortablePostgresPool(config, dependencies = {}) {
  return createVerifiedPool(config, dependencies, true);
}

// Only the separately invoked administrator migration CLI uses this factory.
// Runtime configuration cannot toggle the application's role validation.
export function createPortableMigrationPool(config, dependencies = {}) {
  return createVerifiedPool(config, dependencies, false);
}

function createVerifiedPool(config, dependencies, runtime) {
  const connectionString = validatePostgresConnectionString(config.connectionString, { runtime });
  const ca = readDatabaseCA(config.caCertificateFile);
  const PoolClass = dependencies.Pool ?? Pool;
  const pool = new PoolClass({
    connectionString,
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    max: 4,
    connectionTimeoutMillis: 6000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    query_timeout: 12000,
  });
  pool.on("error", () => console.error("Ward Flow database connection unavailable"));
  return pool;
}

/** Accept only CA certificate bundles and keep filesystem/parser diagnostics private. */
export function readDatabaseCA(certificateFile) {
  let ca;
  if (certificateFile) {
    try {
      ca = readFileSync(certificateFile, "utf8");
      const certificates = ca.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
      if (
        !certificates?.length ||
        ca.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, "").trim() ||
        certificates.some((certificate) => !new X509Certificate(certificate).ca)
      )
        throw new Error();
    } catch {
      throw new Error("Invalid database CA certificate configuration");
    }
  }
  return ca;
}

// Read grants outside ward_flow that stock Supabase (and stock PostgreSQL) give PUBLIC, so every role
// inherits them. System schemas are allowed whole. In extension schemas only the named stock relations
// are allowed: pg_stat_statements' views and pg_cron's RLS-scoped job tables. Checked against a Supabase
// PostgreSQL 17 project's PUBLIC ACLs. Any other readable relation outside ward_flow refuses startup,
// including a new relation that is later added and granted in extensions or cron.
export const FOREIGN_READ_SCHEMA_ALLOWLIST = Object.freeze(["pg_catalog", "information_schema"]);
// [schema, relation] pairs, compared as separate names so a dotted schema name can't impersonate one.
export const FOREIGN_READ_RELATION_ALLOWLIST = Object.freeze(
  [
    ["extensions", "pg_stat_statements"],
    ["extensions", "pg_stat_statements_info"],
    ["cron", "job"],
    ["cron", "job_run_details"],
  ].map((pair) => Object.freeze(pair)),
);
const sqlList = (values) => values.map((value) => `'${value}'`).join(", ");

// One bounded catalogue summary. No payload or credential is read. Missing schema,
// migrations or permissions fail closed; administrators install migrations separately.
export const RUNTIME_SUMMARY = `
WITH runtime AS (SELECT * FROM pg_catalog.pg_roles WHERE rolname = current_user),
browser_roles AS (SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('anon', 'authenticated'))
SELECT current_user AS role,
  NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls OR r.rolinherit)
    AND r.rolcanlogin AS safe_flags,
  -- Both directions: roles the runtime belongs to, and roles that can SET ROLE to it or
  -- inherit it. PostgreSQL 16+ gives a non-superuser creator an ADMIN-only membership
  -- (no SET, no INHERIT); older versions have no such columns, so any grant counts.
  NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member = r.oid
    OR (m.roleid = r.oid AND (COALESCE((pg_catalog.to_jsonb(m) ->> 'set_option')::boolean, true)
      OR COALESCE((pg_catalog.to_jsonb(m) ->> 'inherit_option')::boolean, true)))) AS no_memberships,
  NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspowner = r.oid)
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE relowner = r.oid)
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE proowner = r.oid)
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_database WHERE datname=current_database() AND datdba=r.oid) AS no_ownership,
  pg_catalog.has_schema_privilege(r.oid, 'ward_flow', 'USAGE')
    AND NOT pg_catalog.has_schema_privilege(r.oid, 'ward_flow', 'CREATE')
    -- No CREATE on any schema (PostgreSQL 14 and earlier grant it on public to PUBLIC).
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace s
      WHERE pg_catalog.has_schema_privilege(r.oid, s.oid, 'CREATE')) AS schema_grants,
  -- No read grant (table, column or sequence) outside ward_flow except the allow-listed schemas and relations.
  NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname <> 'ward_flow' AND n.nspname <> ALL (ARRAY[${sqlList(FOREIGN_READ_SCHEMA_ALLOWLIST)}]::text[])
      AND NOT (c.relkind IN ('r', 'v')
        AND (n.nspname::text, c.relname::text) IN (${FOREIGN_READ_RELATION_ALLOWLIST.map((pair) => `(${sqlList(pair)})`).join(", ")}))
      AND CASE WHEN c.relkind IN ('r', 'p', 'v', 'm', 'f') THEN
          (pg_catalog.has_table_privilege(r.oid, c.oid, 'SELECT')
          OR pg_catalog.has_any_column_privilege(r.oid, c.oid, 'SELECT'))
        WHEN c.relkind = 'S' THEN pg_catalog.has_sequence_privilege(r.oid, c.oid, 'SELECT,USAGE')
        ELSE false END) AS foreign_reads_denied,
  pg_catalog.has_table_privilege(r.oid, 'ward_flow.migrations', 'SELECT')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.workspaces', 'SELECT')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.workspaces', 'INSERT')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.workspaces', 'UPDATE')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.commands', 'SELECT')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.commands', 'INSERT')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.audit', 'SELECT')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.audit', 'INSERT')
    AND pg_catalog.has_sequence_privilege(r.oid, 'ward_flow.audit_sequence_seq', 'USAGE') AS required_grants,
  -- setval needs UPDATE; an over-granted role could rewind audit or push IDs.
  NOT pg_catalog.has_sequence_privilege(r.oid, 'ward_flow.audit_sequence_seq', 'UPDATE')
    AND (NOT $1::boolean OR NOT pg_catalog.has_sequence_privilege(r.oid, 'ward_flow.push_subscriptions_id_seq', 'UPDATE'))
    AS sequence_restricted,
  NOT pg_catalog.has_table_privilege(r.oid, 'ward_flow.audit', 'UPDATE')
    AND NOT pg_catalog.has_table_privilege(r.oid, 'ward_flow.audit', 'DELETE')
    AND NOT pg_catalog.has_table_privilege(r.oid, 'ward_flow.audit', 'TRUNCATE')
    AND NOT pg_catalog.has_any_column_privilege(r.oid, 'ward_flow.audit', 'UPDATE') AS audit_append_only,
  NOT EXISTS (SELECT 1 FROM (VALUES ('migrations', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
    ('workspaces', 'DELETE,TRUNCATE,REFERENCES,TRIGGER'), ('commands', 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
    ('audit', 'REFERENCES,TRIGGER')) denied(name, privileges)
    WHERE pg_catalog.has_table_privilege(r.oid, 'ward_flow.' || denied.name, denied.privileges))
    AND NOT pg_catalog.has_any_column_privilege(r.oid, 'ward_flow.commands', 'UPDATE,REFERENCES')
    AND NOT pg_catalog.has_any_column_privilege(r.oid, 'ward_flow.migrations', 'INSERT,UPDATE,REFERENCES')
    AND NOT pg_catalog.has_any_column_privilege(r.oid, 'ward_flow.audit', 'REFERENCES') AS restricted_grants,
  (NOT $1::boolean OR (
    pg_catalog.has_table_privilege(r.oid, 'ward_flow.push_baselines', 'SELECT')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.push_baselines', 'INSERT')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.push_baselines', 'UPDATE')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.push_subscriptions', 'SELECT')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.push_subscriptions', 'INSERT')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.push_subscriptions', 'UPDATE')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.push_subscriptions', 'DELETE')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.push_deliveries', 'SELECT')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.push_deliveries', 'INSERT')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.push_deliveries', 'UPDATE')
    AND pg_catalog.has_table_privilege(r.oid, 'ward_flow.push_deliveries', 'DELETE')
    AND pg_catalog.has_sequence_privilege(r.oid, 'ward_flow.push_subscriptions_id_seq', 'USAGE')
  )) AS push_grants,
  NOT EXISTS (SELECT 1 FROM browser_roles b WHERE
    pg_catalog.has_schema_privilege(b.oid, 'ward_flow', 'USAGE')
    OR pg_catalog.has_schema_privilege(b.oid, 'ward_flow', 'CREATE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'ward_flow' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
        AND CASE WHEN c.relkind IN ('r', 'p', 'v', 'm', 'f') THEN
          (pg_catalog.has_table_privilege(b.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR pg_catalog.has_any_column_privilege(b.oid, c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')) ELSE false END)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'ward_flow' AND c.relkind = 'S'
        AND CASE WHEN c.relkind = 'S' THEN pg_catalog.has_sequence_privilege(b.oid, c.oid, 'USAGE,SELECT,UPDATE') ELSE false END)
  ) AS browser_denied,
  (SELECT array_agg(version ORDER BY version) FROM ward_flow.migrations) AS versions,
  -- Exactly two user triggers in the schema, whatever their state, and both are the guards.
  (SELECT count(*) = 2 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'ward_flow' AND NOT t.tgisinternal)
  AND (SELECT count(*) = 2 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'ward_flow' AND p.pronamespace = n.oid
      AND NOT t.tgisinternal AND t.tgenabled IN ('O', 'A') AND t.tgqual IS NULL
      AND t.tgattr = ''::pg_catalog.int2vector AND t.tgnargs = 0 AND NOT p.prosecdef
      AND p.pronargs = 0 AND p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype
      AND p.prolang = (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
      AND p.proconfig @> ARRAY['search_path=pg_catalog, ward_flow']::text[]
      AND ((c.relname = 'audit' AND t.tgname = 'protect_audit' AND p.proname = 'protect_audit' AND t.tgtype = 58
          AND pg_catalog.regexp_replace(p.prosrc, '[[:space:]]+', '', 'g') =
            pg_catalog.regexp_replace('BEGIN RAISE EXCEPTION ''Ward Flow audit records are append-only''; END', '[[:space:]]+', '', 'g'))
        OR (c.relname = 'workspaces' AND t.tgname = 'protect_workspace_mode'
          AND p.proname = 'protect_workspace_mode' AND t.tgtype = 19
          AND pg_catalog.regexp_replace(p.prosrc, '[[:space:]]+', '', 'g') =
            pg_catalog.regexp_replace('BEGIN IF NEW.data_mode IS DISTINCT FROM OLD.data_mode THEN
              RAISE EXCEPTION ''Ward Flow workspace data mode cannot be changed'';
              END IF; RETURN NEW; END', '[[:space:]]+', '', 'g')))
  ) AS guards_valid
FROM runtime r`;

export async function verifyRuntimeRole(pool, expectedRole, pushEnabled, unavailableMessage, unsafeMessage) {
  let row;
  try {
    const { rows } = await pool.query(RUNTIME_SUMMARY, [pushEnabled === true]);
    if (rows.length !== 1) throw new Error();
    row = rows[0];
  } catch {
    throw new Error(unavailableMessage);
  }
  if (
    row.role !== expectedRole ||
    ![
      "safe_flags",
      "no_memberships",
      "no_ownership",
      "schema_grants",
      "foreign_reads_denied",
      "required_grants",
      "restricted_grants",
      "push_grants",
      "audit_append_only",
      "browser_denied",
      "guards_valid",
      "sequence_restricted",
    ].every((field) => row[field] === true) ||
    !Array.isArray(row.versions) ||
    row.versions.length !== 4 ||
    !row.versions.every((version, index) => version === index + 1)
  )
    throw new Error(unsafeMessage);
}

export async function verifyPortableRuntimeRole(pool, config) {
  const connectionString = validatePortablePostgresUrl(config.connectionString);
  const expectedRole = decodeURIComponent(new URL(connectionString).username);
  return verifyRuntimeRole(
    pool,
    expectedRole,
    config.pushEnabled,
    "Portable database runtime verification unavailable",
    "Unsafe or unprepared portable database runtime",
  );
}
