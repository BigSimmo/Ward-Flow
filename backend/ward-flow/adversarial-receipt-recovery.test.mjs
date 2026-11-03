import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceStore } from "./postgres.mjs";

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
