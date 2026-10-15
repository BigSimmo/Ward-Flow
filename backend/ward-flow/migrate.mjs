// @ts-check
import { LATEST_MIGRATION, MIGRATIONS, readMigration } from "./migrations.mjs";

/**
 * Applies every migration after the database's current version, in order, in one transaction.
 * Run by migrate-supabase.mjs or migrate-postgres.mjs. Every file is checked against its checksum
 * before any SQL runs, so a changed file never half-applies.
 */
export async function migrate(pool) {
  const sql = await Promise.all(MIGRATIONS.map(readMigration));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(782322)");
    const { rows } = await client.query("SELECT to_regclass('ward_flow.migrations') AS relation");
    if (!rows[0].relation) await client.query(sql[0]);
    const version = (await client.query("SELECT max(version) AS version FROM ward_flow.migrations")).rows[0].version;
    if (!Number.isInteger(version) || version < 1 || version > LATEST_MIGRATION)
      throw new Error("Unsupported database migration version");
    for (const [index, migration] of MIGRATIONS.entries())
      if (migration.version > version) await client.query(sql[index]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
