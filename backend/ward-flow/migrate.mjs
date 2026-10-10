import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createPostgresPool } from "./postgres.mjs";
import { readConfig } from "./config.mjs";

export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(782322)");
    const { rows } = await client.query("SELECT to_regclass('ward_flow.migrations') AS relation");
    if (!rows[0].relation)
      await client.query(await readFile(new URL("./migrations/001-shared-workspace.sql", import.meta.url), "utf8"));
    const version = await client.query("SELECT max(version) AS version FROM ward_flow.migrations");
    if (![1, 2, 3].includes(version.rows[0].version)) throw new Error("Unsupported database migration version");
    if (version.rows[0].version === 1)
      await client.query(await readFile(new URL("./migrations/002-workspace-data-mode.sql", import.meta.url), "utf8"));
    if (version.rows[0].version <= 2)
      await client.query(await readFile(new URL("./migrations/003-push-subscriptions.sql", import.meta.url), "utf8"));
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function grantBackend(client, objectId) {
  if (!/^[0-9a-f-]{36}$/i.test(objectId)) throw new Error("Invalid backend identity");
  // Entra-only PostgreSQL. This bootstrap runs under the nominated administrator, not the app.
  const { rows } = await client.query(
    "SELECT * FROM pg_catalog.pgaadauth_list_principals(false) WHERE rolename='wardflow_backend'",
  );
  if (rows.length && String(rows[0].objectId ?? rows[0].objectid).toLowerCase() !== objectId.toLowerCase())
    throw new Error("Backend database identity mismatch");
  if (!rows.length)
    await client.query(
      "SELECT * FROM pg_catalog.pgaadauth_create_principal_with_oid('wardflow_backend', $1, 'service', false, false)",
      [objectId],
    );
  await client.query("GRANT USAGE ON SCHEMA ward_flow TO wardflow_backend");
  await client.query("GRANT SELECT ON ward_flow.migrations TO wardflow_backend");
  await client.query("GRANT SELECT, INSERT, UPDATE ON ward_flow.workspaces TO wardflow_backend");
  await client.query("GRANT SELECT, INSERT ON ward_flow.commands, ward_flow.audit TO wardflow_backend");
  await client.query("GRANT SELECT, INSERT, UPDATE, DELETE ON ward_flow.push_subscriptions TO wardflow_backend");
  await client.query("GRANT SELECT, INSERT, UPDATE ON ward_flow.push_baselines TO wardflow_backend");
  await client.query("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ward_flow TO wardflow_backend");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = readConfig();
  if (!config.postgres) throw new Error("Shared PostgreSQL configuration required");
  const pool = createPostgresPool({ ...config.postgres, user: process.env.WARD_MIGRATION_ADMIN_NAME });
  try {
    if (!process.env.WARD_MIGRATION_ADMIN_NAME || !process.env.WARD_BACKEND_OBJECT_ID)
      throw new Error("Migration administrator and backend identity required");
    await migrate(pool);
    const client = await pool.connect();
    try {
      await grantBackend(client, process.env.WARD_BACKEND_OBJECT_ID);
    } finally {
      client.release();
    }
    console.log("Ward Flow shared schema and backend grants applied");
  } finally {
    await pool.end();
  }
}
