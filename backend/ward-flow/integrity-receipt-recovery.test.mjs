import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceStore } from "./postgres.mjs";

for (const [status, stored, outcome] of [
  [200, "partly", "partly"],
  [200, "accepted", "accepted"],
  [409, "stale", "refused"],
  [422, "refused", "refused"],
]) {
  test(`reload receipt preserves ${stored} without revealing saved details`, async () => {
    const store = createWorkspaceStore(
      {
        async query(sql, values) {
          assert.match(sql, /workspace_id=\$1 AND actor_id=\$2 AND command_id=\$3/);
          assert.deepEqual(values, ["synthetic-workspace", "synthetic-actor", "synthetic-command"]);
          return {
            rows: [
              {
                status,
                result: {
                  outcome: stored,
                  commandRevision: 2,
                  error: "private synthetic target",
                  covered: ["synthetic-record"],
                },
              },
            ],
          };
        },
      },
      { workspaceId: "synthetic-workspace", engine: { ACCESS_MAX_TERM_MINUTES: 60 } },
    );
    assert.deepEqual(await store.receipt("synthetic-actor", "synthetic-command"), { outcome, commandRevision: 2 });
  });
}

test("reload receipt returns no outcome when no actor-scoped command is retained", async () => {
  const store = createWorkspaceStore(
    { query: async () => ({ rows: [] }) },
    { workspaceId: "synthetic-workspace", engine: { ACCESS_MAX_TERM_MINUTES: 60 } },
  );
  assert.equal(await store.receipt("synthetic-actor", "synthetic-command"), null);
});
