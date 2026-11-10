// @ts-check
// Audit M3 (D-111 "audit item 33"): Supabase's browser roles can read, write and call nothing in
// Ward Flow's schema; all access goes through the backend. Runs only against CI's own isolated
// loopback PostgreSQL (WARD_TEST_DATABASE_URL). Synthetic data only; no provider is contacted.
// The hosted half of M3 (confirming the live project does not expose the schema) is a separate,
// owner-approved check and is not done here.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { dropTestDatabase } from "./drop-test-database.test-support.mjs";
import { migrate } from "./migrate.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Browser-role refusal tests require isolated loopback PostgreSQL");

const BROWSER_ROLES = ["anon", "authenticated"];
const PERMISSION_DENIED = "42501";

/** Every object in ward_flow the probes must cover, read from the catalogue so new ones are included. */
async function schemaObjects(client) {
  const { rows: relations } = await client.query(
    "SELECT c.relname AS name, c.relkind AS kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ward_flow' AND c.relkind IN ('r','p','v','m','f','S') ORDER BY c.relname",
  );
  const { rows: functions } = await client.query(
    "SELECT p.oid::regprocedure::text AS signature, p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ward_flow' ORDER BY p.proname",
  );
  const { rows: firstColumns } = await client.query(
    "SELECT DISTINCT ON (c.relname) c.relname AS name, a.attname AS column FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped AND a.attidentity='' AND a.attgenerated='' WHERE n.nspname='ward_flow' ORDER BY c.relname, a.attnum",
  );
  return {
    firstColumn: Object.fromEntries(firstColumns.map((row) => [row.name, row.column])),
    tables: relations.filter((row) => row.kind !== "S").map((row) => row.name),
    sequences: relations.filter((row) => row.kind === "S").map((row) => row.name),
    functions,
  };
}

/** Catalogue privileges a browser role holds anywhere in ward_flow; an empty list means none. */
async function heldPrivileges(client, role, objects) {
  const held = [];
  const check = async (label, sql, values) => {
    const { rows } = await client.query(sql, values);
    if (rows[0].allowed) held.push(label);
  };
  for (const privilege of ["USAGE", "CREATE"])
    await check(`schema ${privilege}`, "SELECT has_schema_privilege($1, 'ward_flow', $2) AS allowed", [
      role,
      privilege,
    ]);
  for (const table of objects.tables) {
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"])
      await check(`${table} ${privilege}`, "SELECT has_table_privilege($1, $2, $3) AS allowed", [
        role,
        `ward_flow.${table}`,
        privilege,
      ]);
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "REFERENCES"])
      await check(`${table} column ${privilege}`, "SELECT has_any_column_privilege($1, $2, $3) AS allowed", [
        role,
        `ward_flow.${table}`,
        privilege,
      ]);
  }
  for (const sequence of objects.sequences)
    for (const privilege of ["USAGE", "SELECT", "UPDATE"])
      await check(`${sequence} ${privilege}`, "SELECT has_sequence_privilege($1, $2, $3) AS allowed", [
        role,
        `ward_flow.${sequence}`,
        privilege,
      ]);
  for (const fn of objects.functions)
    await check(`${fn.name} EXECUTE`, "SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed", [
      role,
      fn.signature,
    ]);
  return held;
}

/**
 * Runs `sql` as `role` inside a rolled-back transaction. Returns the SQLSTATE it failed with, or
 * "ok" when the statement ran.
 */
async function asRole(pool, role, sql) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL ROLE ${role}`);
    try {
      await client.query(sql);
      return "ok";
    } catch (error) {
      return /** @type {any} */ (error).code ?? "unknown";
    }
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
}

/** The statements a browser key could send for each object; every one must be refused. */
function attempts(objects) {
  const list = [];
  for (const table of objects.tables) {
    const name = `ward_flow.${table}`;
    list.push([`${table} read`, `SELECT * FROM ${name} LIMIT 1`]);
    list.push([`${table} add`, `INSERT INTO ${name} DEFAULT VALUES`]);
    const column = objects.firstColumn[table];
    list.push([`${table} change`, `UPDATE ${name} SET "${column}"="${column}" WHERE false`]);
    list.push([`${table} remove`, `DELETE FROM ${name} WHERE false`]);
    list.push([`${table} empty`, `TRUNCATE ${name}`]);
  }
  for (const sequence of objects.sequences) {
    list.push([`${sequence} next`, `SELECT nextval('ward_flow.${sequence}')`]);
    list.push([`${sequence} set`, `SELECT setval('ward_flow.${sequence}', 1)`]);
    list.push([`${sequence} read`, `SELECT last_value FROM ward_flow.${sequence}`]);
  }
  for (const fn of objects.functions) list.push([`${fn.name} call`, `SELECT ${fn.signature.replace("()", "")}()`]);
  return list;
}

test(
  "real PostgreSQL: Supabase's browser roles are refused on every Ward Flow table, sequence and function",
  { skip: !url, timeout: 60_000 },
  async (t) => {
    const admin = new Pool({ connectionString: url, max: 1 });
    const database = `wardflow_m3_${randomUUID().replaceAll("-", "")}`;
    const target = new URL(/** @type {string} */ (url));
    target.pathname = `/${database}`;
    // Supabase's browser roles, created as Supabase has them (no login of their own; PostgREST
    // switches to them). Cluster-wide, so created only when missing.
    for (const role of BROWSER_ROLES)
      await admin.query(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF; END $$`,
      );
    await admin.query(`CREATE DATABASE ${database}`);
    const owner = new Pool({ connectionString: target.href, max: 2 });
    try {
      await migrate(owner);
      await owner.query(await readFile(new URL("./infra/supabase-runtime-role.sql", import.meta.url), "utf8"));
      // One synthetic workspace and audit row, so a read that slipped through would have a row to see.
      const workspaceId = randomUUID();
      await owner.query("INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES ($1, 1, '{}'::jsonb)", [
        workspaceId,
      ]);
      await owner.query(
        "INSERT INTO ward_flow.audit(workspace_id, actor_id, action, outcome, prior_revision, revision, changes) VALUES ($1, $2, 'INITIALISE_WORKSPACE', 'accepted', 0, 1, '{}'::jsonb)",
        [workspaceId, randomUUID()],
      );
      const objects = await schemaObjects(owner);
      assert.ok(objects.tables.includes("audit") && objects.tables.includes("workspace_records"));
      assert.ok(objects.sequences.includes("audit_sequence_seq"));
      assert.ok(objects.functions.some((fn) => fn.name === "protect_audit"));

      for (const role of BROWSER_ROLES) {
        await t.test(`${role} holds no privilege on the schema or any object in it`, async () => {
          assert.deepEqual(await heldPrivileges(owner, role, objects), []);
        });
        await t.test(`${role} is refused on every read, write, sequence step and function call`, async () => {
          const allowed = [];
          for (const [label, sql] of attempts(objects)) {
            const code = await asRole(owner, role, sql);
            if (code !== PERMISSION_DENIED) allowed.push(`${label}: ${code}`);
          }
          assert.deepEqual(allowed, [], "every attempt must end in permission denied");
        });
        await t.test(`${role} is still refused object by object if the schema were opened to it`, async () => {
          // The closed schema is the first wall. Open it inside a rolled-back transaction to show
          // that no table, sequence or function grant sits behind it either.
          const allowed = [];
          for (const [label, sql] of attempts(objects)) {
            const client = await owner.connect();
            try {
              await client.query("BEGIN");
              await client.query(`GRANT USAGE ON SCHEMA ward_flow TO ${role}`);
              await client.query(`SET LOCAL ROLE ${role}`);
              const code = await client.query(sql).then(
                () => "ok",
                (error) => error.code ?? "unknown",
              );
              if (code !== PERMISSION_DENIED) allowed.push(`${label}: ${code}`);
            } finally {
              await client.query("ROLLBACK").catch(() => {});
              client.release();
            }
          }
          assert.deepEqual(allowed, [], "every object refuses the role on its own grants");
          assert.deepEqual(await heldPrivileges(owner, role, objects), [], "the opened schema was rolled back");
        });
      }

      await t.test("the probes notice a mistaken grant, and row security still hides every row", async () => {
        // Negative control: a grant given by mistake must show up in both probes. Row security
        // (migration 6) is the second wall: the role can then run the read but sees no rows, and
        // cannot add one.
        await owner.query("GRANT USAGE ON SCHEMA ward_flow TO anon");
        await owner.query("GRANT SELECT, INSERT ON ward_flow.audit TO anon");
        try {
          assert.deepEqual(await heldPrivileges(owner, "anon", objects), [
            "schema USAGE",
            "audit SELECT",
            "audit INSERT",
            "audit column SELECT",
            "audit column INSERT",
          ]);
          assert.equal(await asRole(owner, "anon", "SELECT * FROM ward_flow.audit LIMIT 1"), "ok");
          const client = await owner.connect();
          try {
            await client.query("BEGIN");
            await client.query("SET LOCAL ROLE anon");
            const { rowCount } = await client.query("SELECT * FROM ward_flow.audit");
            assert.equal(rowCount, 0, "row security hides the audit row from a browser role");
          } finally {
            await client.query("ROLLBACK");
            client.release();
          }
          assert.equal(
            await asRole(
              owner,
              "anon",
              `INSERT INTO ward_flow.audit(workspace_id, actor_id, action, outcome, prior_revision, revision, changes) VALUES ('${workspaceId}', '${randomUUID()}', 'FORGED', 'accepted', 1, 1, '{}')`,
            ),
            PERMISSION_DENIED,
            "row security refuses a browser role's insert even with a table grant",
          );
        } finally {
          await owner.query("REVOKE ALL ON ward_flow.audit FROM anon");
          await owner.query("REVOKE ALL ON SCHEMA ward_flow FROM anon");
        }
        assert.deepEqual(await heldPrivileges(owner, "anon", objects), []);
      });

      await t.test("re-running the runtime grants removes a browser grant left by mistake", async () => {
        await owner.query("GRANT USAGE ON SCHEMA ward_flow TO authenticated");
        await owner.query("GRANT ALL ON ALL TABLES IN SCHEMA ward_flow TO authenticated");
        await owner.query("GRANT ALL ON ALL SEQUENCES IN SCHEMA ward_flow TO authenticated");
        await owner.query("GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ward_flow TO authenticated");
        assert.notDeepEqual(await heldPrivileges(owner, "authenticated", objects), []);
        await owner.query(await readFile(new URL("./infra/supabase-runtime-role.sql", import.meta.url), "utf8"));
        assert.deepEqual(await heldPrivileges(owner, "authenticated", objects), []);
      });
    } finally {
      await owner.end();
      await dropTestDatabase(admin, database);
      await admin.end();
    }
  },
);
