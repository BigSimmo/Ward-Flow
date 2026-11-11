#!/usr/bin/env node
// Audit M81 (10 November 2026): live matches the repo. There is no staging, so this compares the
// live database's migration version, tables, row-level security, policies and runtime grants, and
// the backend service's setting names, with what the repo declares. It never connects to anything.
//
//   node scripts/ward-flow/live-schema-diff.mjs --print-query
//       prints one read-only SQL query. A person with Josh's yes runs it on the Ward Flow database
//       (for example in the Supabase SQL editor) and saves the one JSON value it returns to a file.
//   node scripts/ward-flow/live-schema-diff.mjs --snapshot <file.json> [--settings <names.txt>]
//       prints a names-only difference. <names.txt> holds the backend service's setting names, one
//       per line, copied from Railway without values; a line holding "=" is refused so a value is
//       never read. Exits 0 when nothing differs, 2 when something does, 1 on bad input.
//
// The startup preflight (backend/ward-flow/postgres-preflight.mjs) already refuses an unexpected
// schema, but says only "refused". This names what differs, so a person can act on it.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BACKEND = path.join(ROOT, "backend/ward-flow");
const RUNTIME_ROLE = "wardflow_backend";

/** The read-only query. Every value it returns is a name or a number, never row content. */
export const SNAPSHOT_QUERY = `WITH t AS (
  SELECT c.oid, c.relname, c.relkind, c.relrowsecurity, c.relacl FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'ward_flow'
), table_grants AS (
  SELECT g.table_name, g.privilege_type FROM information_schema.role_table_grants g
  WHERE g.grantee = '${RUNTIME_ROLE}' AND g.table_schema = 'ward_flow'
)
SELECT json_build_object(
  'migration', (SELECT max(version) FROM ward_flow.migrations),
  'tables', (SELECT coalesce(json_agg(relname ORDER BY relname), '[]') FROM t WHERE relkind = 'r'),
  'rls', (SELECT coalesce(json_agg(relname ORDER BY relname), '[]') FROM t WHERE relkind = 'r' AND relrowsecurity),
  'policies', (SELECT coalesce(json_agg(tablename || '.' || policyname ORDER BY tablename, policyname), '[]')
    FROM pg_catalog.pg_policies WHERE schemaname = 'ward_flow'),
  'grants', (SELECT coalesce(json_agg(name ORDER BY name), '[]') FROM (
    SELECT 'table:' || table_name || ':' || privilege_type AS name FROM table_grants
    UNION SELECT 'column:' || p.table_name || '.' || p.column_name || ':' || p.privilege_type
      FROM information_schema.column_privileges p
      WHERE p.grantee = '${RUNTIME_ROLE}' AND p.table_schema = 'ward_flow'
        AND (p.table_name, p.privilege_type) NOT IN (SELECT table_name, privilege_type FROM table_grants)
    UNION SELECT 'sequence:' || t.relname || ':' || a.privilege_type
      FROM t, LATERAL pg_catalog.aclexplode(t.relacl) a
      WHERE t.relkind = 'S' AND a.grantee = '${RUNTIME_ROLE}'::regrole
    UNION SELECT 'schema:ward_flow:USAGE' WHERE has_schema_privilege('${RUNTIME_ROLE}', 'ward_flow', 'USAGE')
  ) g)
) AS snapshot;`;

/** Splits "SELECT, UPDATE (a, b)" at the commas outside brackets. */
function privileges(list) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const character of list) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += character;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** The runtime grants the repo's role script declares, as names like "table:audit:INSERT". */
export function declaredGrants(sql) {
  const names = new Set();
  const statement = /GRANT\s+([^;]+?)\s+ON\s+(SCHEMA\s+|SEQUENCE\s+)?([^;]+?)\s+TO\s+wardflow_backend\s*;/giu;
  for (const [, list, kind, targets] of sql.matchAll(statement)) {
    const objects = targets.split(",").map((target) => target.trim().replace(/^ward_flow\./u, ""));
    for (const privilege of privileges(list)) {
      const column = privilege.match(/^(\w+)\s*\(([^)]*)\)$/u);
      for (const object of objects) {
        if (/^SCHEMA/iu.test(kind ?? "")) names.add(`schema:${object}:${privilege.toUpperCase()}`);
        else if (/^SEQUENCE/iu.test(kind ?? "")) names.add(`sequence:${object}:${privilege.toUpperCase()}`);
        else if (column)
          for (const name of column[2].split(","))
            names.add(`column:${object}.${name.trim()}:${column[1].toUpperCase()}`);
        else names.add(`table:${object}:${privilege.toUpperCase()}`);
      }
    }
  }
  return [...names].sort();
}

/** Setting names the backend reads, from its source (tests excluded). */
export function backendSettingNames(dir = BACKEND) {
  const names = new Set();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".mjs") || /\.test(?:-support)?\.mjs$/u.test(file)) continue;
    const source = readFileSync(path.join(dir, file), "utf8");
    for (const [, name] of source.matchAll(/\b(?:env|environment)\.([A-Z][A-Z0-9_]+)\b/gu)) names.add(name);
  }
  return [...names].sort();
}

/** What the repo declares, read from the migrations, the runtime role script and the settings template. */
export function repoDeclared(root = ROOT) {
  const backend = path.join(root, "backend/ward-flow");
  const files = readdirSync(path.join(backend, "migrations"))
    .filter((file) => /^\d{3}-.+\.sql$/u.test(file))
    .sort();
  const sql = files.map((file) => readFileSync(path.join(backend, "migrations", file), "utf8")).join("\n");
  const tables = new Set([...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?ward_flow\.(\w+)/gu)].map((m) => m[1]));
  for (const [, table] of sql.matchAll(/DROP TABLE (?:IF EXISTS )?ward_flow\.(\w+)/gu)) tables.delete(table);
  const rls = [...sql.matchAll(/ALTER TABLE ward_flow\.(\w+) ENABLE ROW LEVEL SECURITY/gu)].map((m) => m[1]);
  const policies = new Set();
  for (const match of sql.matchAll(/(CREATE|DROP) POLICY (?:IF EXISTS )?"?(\w+)"? ON ward_flow\.(\w+)/gu)) {
    const name = `${match[3]}.${match[2]}`;
    if (match[1] === "CREATE") policies.add(name);
    else policies.delete(name);
  }
  const template = readFileSync(path.join(backend, "infra/supabase-settings.template.env"), "utf8");
  const required = [...template.matchAll(/^([A-Z][A-Z0-9_]*)=/gmu)].map((m) => m[1]);
  return {
    migration: Number(files.at(-1)?.slice(0, 3) ?? 0),
    tables: [...tables].sort(),
    rls: [...new Set(rls)].sort(),
    policies: [...policies].sort(),
    grants: declaredGrants(readFileSync(path.join(backend, "infra/supabase-runtime-role.sql"), "utf8")),
    // The uptime monitor's token is documented in the backend README, not the template. Railway
    // supplies PORT itself and the template's HOST is for a local run.
    requiredSettings: [...new Set([...required, "WARD_FLOW_UPTIME_TOKEN"])]
      .filter((name) => name !== "HOST" && name !== "PORT")
      .sort(),
    knownSettings: [...new Set([...required, "WARD_FLOW_UPTIME_TOKEN", ...backendSettingNames(backend)])].sort(),
  };
}

/** Reads setting names, one per line, refusing anything that looks like a value. */
export function parseSettingNames(text) {
  const names = [];
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.includes("=") || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(line))
      throw new Error("The settings file must hold names only, one per line, with no values.");
    names.push(line);
  }
  return names;
}

const only = (left, right) => left.filter((name) => !right.includes(name));

/** Names the hosting platform sets for itself, never compared. */
const PLATFORM_SETTING = /^(?:RAILWAY_|NIXPACKS_|RAILPACK_)/u;

/**
 * The names-only difference. `live` is the query's JSON; `settings` the live setting names, or null
 * when none were given. A required setting live lacks is listed, and so is any live name the repo
 * never reads, such as a misspelt one (M54); names Railway sets for itself are left out.
 * @param {object} declared
 * @param {object} live
 * @param {string[] | null} [settings]
 */
export function diffLive(declared, live, settings = null) {
  const lines = [];
  const section = (title, missing, extra) => {
    for (const name of missing) lines.push(`${title}: in the repo, not on live: ${name}`);
    for (const name of extra) lines.push(`${title}: on live, not in the repo: ${name}`);
  };
  for (const key of ["tables", "rls", "policies", "grants"])
    if (!Array.isArray(live?.[key])) throw new Error(`The snapshot has no ${key} list; rerun the query.`);
  if (Number(live.migration) !== declared.migration)
    lines.push(`migration: repo is at ${declared.migration}, live is at ${live.migration ?? "none"}`);
  section("table", only(declared.tables, live.tables), only(live.tables, declared.tables));
  section("row-level security", only(declared.rls, live.rls), only(live.rls, declared.rls));
  section("policy", only(declared.policies, live.policies), only(live.policies, declared.policies));
  section("runtime grant", only(declared.grants, live.grants), only(live.grants, declared.grants));
  if (settings) {
    const own = settings.filter((name) => !PLATFORM_SETTING.test(name));
    section("setting", only(declared.requiredSettings, own), only(own, declared.knownSettings));
  }
  return lines;
}

function main(args) {
  if (args.includes("--print-query")) {
    process.stdout.write(`${SNAPSHOT_QUERY}\n`);
    return 0;
  }
  const at = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const snapshotFile = at("--snapshot");
  if (!snapshotFile) {
    console.error("Usage: live-schema-diff.mjs --print-query | --snapshot <file.json> [--settings <names.txt>]");
    return 1;
  }
  try {
    let live = JSON.parse(readFileSync(snapshotFile, "utf8"));
    if (live && typeof live === "object" && "snapshot" in live) live = live.snapshot;
    const settingsFile = at("--settings");
    const settings = settingsFile ? parseSettingNames(readFileSync(settingsFile, "utf8")) : null;
    const lines = diffLive(repoDeclared(), live, settings);
    if (!settings) console.log("Setting names not compared: no --settings file given.");
    if (!lines.length) {
      console.log("Live matches the repo: migration, tables, row-level security, policies and grants.");
      return 0;
    }
    for (const line of lines) console.log(line);
    return 2;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = main(process.argv.slice(2));
