import { readFile } from "node:fs/promises";

/** Applies migrations 1 to 5 in order. Run by migrate-supabase.mjs or migrate-postgres.mjs. */
export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(782322)");
    const { rows } = await client.query("SELECT to_regclass('ward_flow.migrations') AS relation");
    if (!rows[0].relation)
      await client.query(await readFile(new URL("./migrations/001-shared-workspace.sql", import.meta.url), "utf8"));
    const version = await client.query("SELECT max(version) AS version FROM ward_flow.migrations");
    if (![1, 2, 3, 4, 5].includes(version.rows[0].version)) throw new Error("Unsupported database migration version");
    if (version.rows[0].version === 1)
      await client.query(await readFile(new URL("./migrations/002-workspace-data-mode.sql", import.meta.url), "utf8"));
    if (version.rows[0].version <= 2)
      await client.query(await readFile(new URL("./migrations/003-push-subscriptions.sql", import.meta.url), "utf8"));
    if (version.rows[0].version <= 3)
      await client.query(await readFile(new URL("./migrations/004-trigger-search-path.sql", import.meta.url), "utf8"));
    if (version.rows[0].version <= 4)
      await client.query(
        await readFile(new URL("./migrations/005-retention-and-indexes.sql", import.meta.url), "utf8"),
      );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
