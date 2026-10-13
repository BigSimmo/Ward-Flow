import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { readPortablePostgresConfig, validatePostgresConnectionString } from "./postgres-config.mjs";
import { createPortableMigrationPool } from "./portable-postgres.mjs";
import { migrate } from "./migrate.mjs";
import { verifyPostgresNamespace } from "./postgres-preflight.mjs";

export function readMigrationConfig(env = process.env) {
  const runtime = readPortablePostgresConfig(env);
  const connectionString = validatePostgresConnectionString(env.WARD_POSTGRES_MIGRATION_DATABASE_URL, {
    runtime: false,
  });
  const target = new URL(connectionString);
  const app = new URL(runtime.connectionString);
  if (
    target.hostname !== app.hostname ||
    (target.port || "5432") !== (app.port || "5432") ||
    target.pathname !== app.pathname ||
    decodeURIComponent(app.username) !== "wardflow_backend" ||
    decodeURIComponent(target.username) === decodeURIComponent(app.username)
  )
    throw new Error("Migration and runtime targets must match with separate identities");
  return { connectionString, caCertificateFile: runtime.caCertificateFile };
}

export async function migratePortablePostgres(pool) {
  await verifyPostgresNamespace(pool);
  await migrate(pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(await readFile(new URL("./infra/postgres-runtime-role.sql", import.meta.url), "utf8"));
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let pool;
  try {
    pool = createPortableMigrationPool(readMigrationConfig());
    await migratePortablePostgres(pool);
    console.log("Ward Flow PostgreSQL schema and restricted grants applied; set the runtime password privately");
  } catch (error) {
    const safeReasons = new Set([
      "Migration and runtime targets must match with separate identities",
      "Invalid database CA certificate configuration",
      "Unrecognised or unsafe Ward Flow database namespace",
      "Unsupported database migration version",
    ]);
    const reason = safeReasons.has(error?.message) ? `: ${error.message}` : "";
    console.error(`PostgreSQL migration refused or unavailable; inspect the private administrator configuration${reason}`);
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
