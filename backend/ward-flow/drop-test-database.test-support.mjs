// @ts-check
// Test-only helper. `pool.end()` resolves before its connections finish closing, so dropping a test
// database straight after it can still find those connections open. DROP ... WITH (FORCE) then
// kills them mid-close, and the client reports "terminating connection due to administrator
// command" as a test failure. Wait for them to leave first; FORCE stays as the last resort.

/**
 * @param {{ query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<{ n: number }> }> }} admin
 * @param {string} database
 */
export async function dropTestDatabase(admin, database) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const { rows } = await admin.query("SELECT count(*)::integer AS n FROM pg_stat_activity WHERE datname = $1", [
      database,
    ]);
    if (rows[0].n === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
}
