// @ts-check
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { pruneReceiptsAsPruner, readSupabasePrunerConfig } from "./prune-receipts.mjs";
import { APPROVED_SUPABASE_POOLER, APPROVED_SUPABASE_PROJECT } from "./supabase-config.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

test("the receipt clean-up workflow accepts only the wardflow_pruner login on the approved project", () => {
  const direct = `postgresql://wardflow_pruner:secret@db.${APPROVED_SUPABASE_PROJECT}.supabase.co:5432/postgres`; // precommit-scan: allow - fixed dummy parser fixture; never used to connect.
  const pooled = `postgresql://wardflow_pruner.${APPROVED_SUPABASE_PROJECT}:secret@${APPROVED_SUPABASE_POOLER}:5432/postgres`; // precommit-scan: allow - fixed dummy parser fixture; never used to connect.
  assert.equal(readSupabasePrunerConfig({ WARD_SUPABASE_PRUNE_DATABASE_URL: direct }).connectionString, direct);
  assert.equal(readSupabasePrunerConfig({ WARD_SUPABASE_PRUNE_DATABASE_URL: pooled }).connectionString, pooled);
  for (const refused of [
    direct.replace("wardflow_pruner", "postgres"),
    direct.replace("wardflow_pruner", "wardflow_backend"),
    direct.replace(APPROVED_SUPABASE_PROJECT, "someotherproject"),
    undefined,
  ])
    assert.throws(() => readSupabasePrunerConfig({ WARD_SUPABASE_PRUNE_DATABASE_URL: refused }));
});

test(
  "real PostgreSQL: the pruner login removes only receipts older than 7 days and can read nothing",
  { skip: !url, timeout: 30_000 },
  async () => {
    const control = new Pool({ connectionString: url, max: 2 });
    let pruner;
    try {
      await migrate(control);
      await control.query(await readFile(new URL("./infra/supabase-prune-role.sql", import.meta.url), "utf8"));
      const password = randomUUID();
      await control.query(`ALTER ROLE wardflow_pruner PASSWORD '${password}'`);
      const workspaceId = randomUUID();
      await control.query("INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES ($1, 1, '{}'::jsonb)", [
        workspaceId,
      ]);
      const receipt = (id, daysAgo) =>
        control.query(
          "INSERT INTO ward_flow.commands(workspace_id, actor_id, command_id, fingerprint, status, result, committed_at) VALUES ($1, $2, $3, 'f', 200, '{}'::jsonb, now() - make_interval(days => $4))",
          [workspaceId, randomUUID(), id, daysAgo],
        );
      const old = randomUUID();
      const recent = randomUUID();
      await receipt(old, 8);
      await receipt(recent, 6);

      const login = new URL(/** @type {string} */ (url));
      login.username = "wardflow_pruner";
      login.password = password;
      pruner = new Pool({ connectionString: login.toString(), max: 1 });
      await assert.rejects(pruner.query("SELECT count(*) FROM ward_flow.commands"), /permission denied/);
      await assert.rejects(pruner.query("DELETE FROM ward_flow.commands"), /permission denied/);
      await assert.rejects(pruner.query("SELECT count(*) FROM ward_flow.audit"), /permission denied/);
      assert.ok((await pruneReceiptsAsPruner(pruner)) >= 1);

      const { rows } = await control.query(
        "SELECT command_id::text FROM ward_flow.commands WHERE workspace_id=$1 ORDER BY command_id",
        [workspaceId],
      );
      assert.deepEqual(
        rows.map((row) => row.command_id),
        [recent],
      );
      // A call can never shorten the window or take more than one batch.
      const { rows: capped } = await pruner.query("SELECT ward_flow_ops.prune_receipts(1000000) AS removed");
      assert.ok(Number(capped[0].removed) <= 5000);
      await control.query("DELETE FROM ward_flow.commands WHERE workspace_id=$1", [workspaceId]);
      await control.query("DELETE FROM ward_flow.workspaces WHERE id=$1", [workspaceId]);
    } finally {
      await pruner?.end();
      await control.end();
    }
  },
);
