// @ts-check
// Help remembered by account (migration 17). Desk role ids, static Help topic ids and What's new
// entry ids only, kept per signed-in account. Synthetic data only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { accountPreferencesInput, accountPreferencesStore } from "./account-preferences.mjs";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { createSharedHandler } from "./shared-http.mjs";
import { STATEWIDE_VIEW } from "./viewer.test-support.mjs";
import { dropTestDatabase } from "./drop-test-database.test-support.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

const tours = ["coordinator", "ward"];
const tips = ["coordinator:capacity", "ward:ward"];
const whatsNew = ["2026-11-03-home-flow", "2026-11-04-help-by-account"];

test("a preferences body is checked: closed desk ids, tip marks, What's new ids and a yes or no", () => {
  assert.deepEqual(accountPreferencesInput({ tours, tips, whatsNew, tipsOff: true }), {
    tours,
    tips,
    whatsNew,
    tipsOff: true,
  });
  assert.deepEqual(accountPreferencesInput({ tipsOff: false }), { tipsOff: false });
  // Repeats are sent once.
  assert.deepEqual(accountPreferencesInput({ tours: ["ward", "ward"] }), { tours: ["ward"] });
  for (const body of [
    null,
    [],
    {},
    { tours: "ward" },
    { tours: ["nurse"] },
    { tips: ["ward"] },
    { tips: ["nurse:ward"] },
    { tips: ["ward:Ward Answer"] },
    { tips: ["ward:/ward-flow/ward/rph"] },
    { whatsNew: ["typed text"] },
    { whatsNew: ["2026-11-04-PT-0001"] },
    { tipsOff: "yes" },
    // Anything else, such as typed text, is refused rather than dropped.
    { tours, note: "typed text" },
    { tips: ["ward:topic-1"] },
    {
      tips: Array.from(
        { length: 201 },
        (_, index) => `ward:topic-${String.fromCharCode(97 + (index % 26)).repeat(1 + Math.floor(index / 26))}`,
      ),
    },
  ])
    assert.equal(accountPreferencesInput(body), null, JSON.stringify(body)?.slice(0, 80));
});

test("before migration 17 the store says Help is not shared, and touches no table", async () => {
  const queries = [];
  const store = accountPreferencesStore({
    pool: { query: async (sql) => (queries.push(sql), { rows: [] }) },
    workspaceId: randomUUID(),
    schemaVersion: async () => 16,
    forgetVersionOnMissing: () => {},
  });
  assert.deepEqual(await store.accountPreferences({ actorId: randomUUID() }), { shared: false });
  assert.deepEqual(await store.recordAccountPreferences({ actorId: randomUUID() }, { tours }), { shared: false });
  assert.deepEqual(queries, []);
});

test("the route keys Help by the signed-in account, checks the body, and answers an older store as not shared", async () => {
  const actor = "33333333-3333-4333-8333-333333333333";
  const seen = [];
  const handler = (store) =>
    createSharedHandler({
      config: { coordinatorIds: [actor], workspaceId: "synthetic-workspace" },
      store: { viewer: async () => ({ ...STATEWIDE_VIEW, actorId: actor }), ...store },
      authenticate: async () => actor,
      readBody: async (incoming) => incoming.json(),
      verifierUnavailable: Error,
      log: () => {},
    });
  const request = (method = "GET", body) =>
    new Request("https://example.test/v1/workspace/preferences", {
      method,
      headers: { authorization: "Bearer synthetic", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  assert.deepEqual(await (await handler({})(request())).json(), { shared: false });

  const shared = handler({
    accountPreferences: async (view) => (seen.push(["read", view.actorId]), { shared: true, tours: [] }),
    recordAccountPreferences: async (view, input) => (seen.push(["record", view.actorId, input]), { shared: true }),
  });
  assert.deepEqual(await (await shared(request())).json(), { shared: true, tours: [] });
  assert.equal((await shared(request("POST", { tours: ["nurse"] }))).status, 400);
  assert.equal((await shared(request("POST", { actorId: randomUUID(), tours }))).status, 400);
  assert.equal((await shared(request("POST", { tours }))).status, 200);
  assert.deepEqual(seen, [
    ["read", actor],
    ["record", actor, { tours }],
  ]);
});

test(
  "real PostgreSQL: each account's Help memory adds up across devices, keeps tips off until changed, and rolls back",
  { skip: !url, timeout: 60_000 },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const admin = new Pool({ connectionString: url, max: 1 });
    const database = `wardflow_preferences_${randomUUID().replaceAll("-", "")}`;
    const target = new URL(/** @type {string} */ (url));
    target.pathname = `/${database}`;
    await admin.query(`CREATE DATABASE ${database}`);
    const pool = new Pool({ connectionString: target.href, max: 2 });
    const workspaceId = randomUUID();
    try {
      await migrate(pool);
      const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date() });
      // The workspace row the table's foreign key names.
      await store.read(randomUUID());
      const account = { actorId: randomUUID() };
      const colleague = { actorId: randomUUID() };
      const empty = { shared: true, tours: [], tips: [], whatsNew: [], tipsOff: null };
      assert.deepEqual(await store.accountPreferences(account), empty);

      // The phone saves its tour and a tip; the PC saves another tip and What's new.
      await store.recordAccountPreferences(account, { tours: ["ward"], tips: ["ward:ward"] });
      const both = await store.recordAccountPreferences(account, {
        tours: ["coordinator", "ward"],
        tips: ["coordinator:capacity", "ward:ward"],
        whatsNew,
      });
      assert.deepEqual(both, {
        shared: true,
        tours: ["coordinator", "ward"],
        tips: ["ward:ward", "coordinator:capacity"],
        whatsNew,
        tipsOff: null,
      });

      // Tips off stays off until the person turns them on again; a save without it changes nothing.
      await store.recordAccountPreferences(account, { tipsOff: true });
      assert.equal((await store.recordAccountPreferences(account, { tours: ["ed"] })).tipsOff, true);
      assert.equal((await store.recordAccountPreferences(account, { tipsOff: false })).tipsOff, false);

      // Another account's memory is its own.
      assert.deepEqual(await store.accountPreferences(colleague), empty);

      // A full list keeps its newest marks.
      // Topic ids are letters and hyphens, so the marks count in letters: topic-aa, topic-ab and on.
      const letters = (index) => String.fromCharCode(97 + Math.floor(index / 26), 97 + (index % 26));
      const many = Array.from({ length: 200 }, (_, index) => `ward:topic-${letters(index)}`);
      const full = await store.recordAccountPreferences(account, { tips: many });
      assert.equal(full.tips.length, 200);
      assert.equal(full.tips.at(-1), `ward:topic-${letters(199)}`);
      assert.ok(!full.tips.includes("ward:ward"), "the oldest mark dropped off");

      // The table refuses a shape the route would, even if a caller skipped the check.
      await assert.rejects(
        pool.query(
          "INSERT INTO ward_flow.account_preferences(workspace_id, actor_id, tours_seen, tips_seen, whats_new_seen) VALUES ($1, $2, '{}', ARRAY['ward:Typed text'], '{}')",
          [workspaceId, randomUUID()],
        ),
        /check constraint/,
      );
      await assert.rejects(
        pool.query(
          "INSERT INTO ward_flow.account_preferences(workspace_id, actor_id, tours_seen, tips_seen, whats_new_seen) VALUES ($1, $2, ARRAY['nurse'], '{}', '{}')",
          [workspaceId, randomUUID()],
        ),
        /check constraint/,
      );

      // The rollback drops the memory, and the same store goes back to each browser's own.
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          await readFile(new URL("./infra/rollback-017-account-preferences.sql", import.meta.url), "utf8"),
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      const afterRollback = createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date() });
      assert.deepEqual(await afterRollback.accountPreferences(account), { shared: false });
    } finally {
      await pool.end();
      await dropTestDatabase(admin, database);
      await admin.end();
    }
  },
);
