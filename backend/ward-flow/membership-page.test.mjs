import { test } from "node:test";
import assert from "node:assert/strict";
import { membershipPage } from "./membership-page.mjs";

const timestamp = "2026-11-05 06:00:00.123456+00";
const row = (n, visible = true) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  granted_key: timestamp,
  visible,
});
function source(rows) {
  return async (_sql, values) => ({ rows: rows.filter((r) => values.length === 2 || r.id > values[3]).slice(0, 500) });
}
test("501 matching grants remain reachable without losing the last row at a tied microsecond", async () => {
  const rows = Array.from({ length: 501 }, (_, i) => row(i));
  const args = { query: source(rows), workspaceId: "synthetic", at: new Date(), keep: (r) => r.visible };
  const first = await membershipPage(args);
  assert.ok(first);
  assert.equal(first.memberships.length, 500);
  assert.equal(first.complete, false);
  const second = await membershipPage({ ...args, cursor: first.nextCursor });
  assert.ok(second);
  assert.deepEqual(second.memberships, [rows[500]]);
  assert.equal(second.complete, true);
  assert.equal(second.nextCursor, null);
});
test("a full scan of out-of-scope rows continues rather than masquerading as an empty complete directory", async () => {
  const rows = Array.from({ length: 5001 }, (_, i) => row(i, i === 5000));
  const args = { query: source(rows), workspaceId: "synthetic", at: new Date(), keep: (r) => r.visible };
  const first = await membershipPage(args);
  assert.ok(first);
  assert.equal(first.complete, false);
  assert.equal(first.memberships.length, 0);
  const second = await membershipPage({ ...args, cursor: first.nextCursor });
  assert.ok(second);
  assert.deepEqual(second.memberships, [rows[5000]]);
  assert.equal(second.complete, true);
});
test("malformed continuation is refused before a query", async () => {
  for (const cursor of [
    "!",
    "a".repeat(513),
    Buffer.from(JSON.stringify(["2026-02-30 06:00:00+00", row(1).id])).toString("base64url"),
    Buffer.from(JSON.stringify(["not-a-date", "not-an-id"])).toString("base64url"),
  ]) {
    const result = await membershipPage({
      query: () => assert.fail("must not query"),
      workspaceId: "synthetic",
      at: new Date(),
      cursor,
      keep: () => true,
    });
    assert.equal(result, null);
  }
});
