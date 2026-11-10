// @ts-check
// Master audit M58 (10 Nov 2026): break glass needs a reason from the list. The store refuses any
// other reason before it opens a transaction, so the pool below is never used. Offline, synthetic.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceStore } from "./postgres.mjs";

test("break glass without a listed reason is refused before the database is touched", async () => {
  const engine = await import("./dist/engine.mjs");
  const unused = () => Promise.reject(new Error("no database in this test"));
  const store = createWorkspaceStore(/** @type {any} */ ({ connect: unused, query: unused }), {
    workspaceId: "00000000-0000-4000-8000-000000000058",
    engine,
  });
  const view = {
    actorId: "00000000-0000-4000-8000-000000000001",
    access: { role: "ward", scope: { kind: "ward", unitIds: ["fre-adult-open"] } },
    membershipId: "00000000-0000-4000-8000-000000000002",
    grants: [],
  };
  for (const reason of [undefined, "", "because", "Other", 42]) {
    const answer = await store.breakGlass(view, "PT-SYN-1", reason);
    assert.equal(answer.status, 400, String(reason));
  }
  assert.ok(engine.BREAK_GLASS_REASON_IDS.length > 1);
});
