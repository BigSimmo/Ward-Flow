import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceStore, NOT_APPLIED_FINGERPRINT } from "./postgres.mjs";

test("receipt preserves partial completion without returning stored rejection text", async () => {
  const rows = [{ status: 200, result: { outcome: "partly", commandRevision: 2, error: "Synthetic private refusal" } }];
  const store = createWorkspaceStore({ query: async () => ({ rows }) }, { workspaceId: "synthetic", engine: {} });
  assert.deepEqual(await store.receipt("synthetic-actor", "synthetic-command"), {
    outcome: "partly",
    commandRevision: 2,
  });
  rows[0].result.outcome = "accepted";
  assert.equal((await store.receipt("synthetic-actor", "synthetic-command"))?.outcome, "accepted");
  rows[0].status = 422;
  assert.equal((await store.receipt("synthetic-actor", "synthetic-command"))?.outcome, "refused");
  rows.length = 0;
  assert.equal(await store.receipt("synthetic-actor", "synthetic-command"), null);
});

// H2 (mechanics and clock audit, 14 Nov 2026): a reload's recovery check (`settle`) records a save
// it still cannot find as not applied, under the workspace lock, so its answer is final and a late
// arrival of that save is refused (`NOT_APPLIED_FINGERPRINT` in `command`). A plain read writes nothing.
test("a recovery check records an unknown save as not applied, under the workspace lock", async () => {
  const commands = new Map();
  const statements = [];
  const select = async (_sql, values) => {
    const row = commands.get(String(values[2]));
    return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
  };
  const client = {
    query: async (sql, values = []) => {
      statements.push(sql.split(" ").slice(0, 2).join(" "));
      if (sql.startsWith("SELECT 1 FROM ward_flow.workspaces")) return { rows: [{}], rowCount: 1 };
      if (sql.startsWith("INSERT INTO ward_flow.commands")) {
        const [, , id, fingerprint, status, result] = values;
        if (!commands.has(id)) commands.set(id, { fingerprint, status, result });
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("SELECT status, result")) return select(sql, values);
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };
  const store = createWorkspaceStore(
    { query: select, connect: async () => client },
    { workspaceId: "synthetic", engine: {} },
  );
  const id = "55555555-5555-4555-8555-555555555555";
  assert.equal(await store.receipt("synthetic-actor", id), null);
  assert.equal(commands.size, 0);
  assert.deepEqual(await store.receipt("synthetic-actor", id, null, { settle: true }), {
    outcome: "refused",
    commandRevision: 0,
  });
  assert.equal(commands.get(id)?.fingerprint, NOT_APPLIED_FINGERPRINT);
  assert.deepEqual(statements, ["BEGIN", "SELECT 1", "INSERT INTO", "SELECT status,", "COMMIT"]);
  const kept = "66666666-6666-4666-8666-666666666666";
  commands.set(kept, { status: 200, result: { outcome: "accepted", commandRevision: 3 }, fingerprint: "synthetic" });
  assert.deepEqual(await store.receipt("synthetic-actor", kept, null, { settle: true }), {
    outcome: "accepted",
    commandRevision: 3,
  });
});
