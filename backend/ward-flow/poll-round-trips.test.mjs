// @ts-check
// The 3 second poll's database round trips: the sign-out check is held for a few seconds per
// sign-in, and a desk's memberships, break glass openings and the workspace revision come back in
// one statement, so an unchanged poll costs one statement where it cost three or four.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";
import { Pool } from "pg";
import * as engine from "./dist/engine.mjs";
import { migrate } from "./migrate.mjs";
import { LATEST_MIGRATION } from "./migrations.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { SIGN_OUT_CHECK_MS } from "./workspace-access.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");
const start = new Date("2026-10-22T10:00:00Z");

/** A database that holds only sign-outs, counting each sign-out read. */
function signOutDatabase() {
  const signedOut = new Set();
  let reads = 0;
  let failNext = false;
  const query = async (/** @type {string} */ sql, /** @type {any[]} */ values = []) => {
    if (sql.startsWith("SELECT max(version)")) return { rows: [{ version: LATEST_MIGRATION }] };
    if (sql.startsWith("SELECT 1 FROM ward_flow.session_sign_outs")) {
      reads += 1;
      if (failNext) {
        failNext = false;
        throw Object.assign(new Error("synthetic outage"), { code: "57P01" });
      }
      return { rows: signedOut.has(values[0]) ? [{ "?column?": 1 }] : [] };
    }
    if (sql.startsWith("INSERT INTO ward_flow.session_sign_outs")) {
      signedOut.add(values[0]);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("DELETE FROM ward_flow.session_sign_outs")) return { rows: [], rowCount: 0 };
    assert.fail(`Unexpected query: ${sql.slice(0, 80)}`);
  };
  const store = createWorkspaceStore(
    { query, connect: async () => ({ query, release() {} }) },
    { workspaceId: randomUUID(), engine, clock: () => new Date(Date.now()), log: () => {}, alert: () => {} },
  );
  return {
    store,
    reads: () => reads,
    /** Another server instance signs this sign-in out. */
    elsewhere: (/** @type {string} */ sessionId) => signedOut.add(sessionId),
    failNextRead: () => {
      failNext = true;
    },
  };
}

test("a sign-out check is held per sign-in for a few seconds, and a sign-out is still enforced", async (t) => {
  mock.timers.enable({ apis: ["Date"], now: start.getTime() });
  t.after(() => mock.timers.reset());
  const db = signOutDatabase();
  const actorId = randomUUID();
  // An unchanged poll every 3 seconds asks the database at most once a window.
  assert.equal(await db.store.sessionSignedOut("session-a"), false);
  assert.equal(await db.store.sessionSignedOut("session-a"), false);
  assert.equal(db.reads(), 1);
  // Signed out through another server instance: seen once the short window passes, never later.
  db.elsewhere("session-a");
  mock.timers.tick(SIGN_OUT_CHECK_MS - 1);
  assert.equal(await db.store.sessionSignedOut("session-a"), false);
  mock.timers.tick(1);
  assert.equal(await db.store.sessionSignedOut("session-a"), true);
  assert.equal(db.reads(), 2);
  // A sign-out once seen is kept: no further read, and it never lapses.
  mock.timers.tick(60 * SIGN_OUT_CHECK_MS);
  assert.equal(await db.store.sessionSignedOut("session-a"), true);
  assert.equal(db.reads(), 2);
  // Signed out through this server: refused at once, even inside a held "not signed out".
  assert.equal(await db.store.sessionSignedOut("session-b"), false);
  assert.equal(await db.store.signOutSession(actorId, "session-b", start.getTime()), true);
  assert.equal(await db.store.sessionSignedOut("session-b"), true);
  assert.equal(db.reads(), 3);
  // A failed read is never held: the next request asks again, and still fails closed upstream.
  db.failNextRead();
  await assert.rejects(db.store.sessionSignedOut("session-c"), /synthetic outage/);
  assert.equal(await db.store.sessionSignedOut("session-c"), false);
  assert.equal(db.reads(), 5);
  // A sign-in with no session id is refused without a read, as before.
  assert.equal(await db.store.sessionSignedOut(undefined), true);
  assert.equal(db.reads(), 5);
});

test(
  "real PostgreSQL: an unchanged member poll is one statement, and access changes still take the full read",
  { skip: !url, timeout: 60_000 },
  async (t) => {
    const pool = new Pool({ connectionString: url, max: 4 });
    t.after(() => pool.end());
    await migrate(pool);
    const workspaceId = randomUUID();
    const lead = randomUUID();
    const nurse = randomUUID();
    let at = new Date(start);
    let statements = 0;
    const counted = {
      async query(/** @type {string} */ sql, /** @type {any[]} */ params) {
        statements += 1;
        return pool.query(sql, params);
      },
      async connect() {
        const client = await pool.connect();
        return {
          query: (/** @type {string} */ sql, /** @type {any[]} */ params) => {
            statements += 1;
            return client.query(sql, params);
          },
          release: client.release.bind(client),
        };
      },
    };
    const store = createWorkspaceStore(counted, {
      workspaceId,
      engine,
      clock: () => new Date(at),
      demoEvents: true,
      slowCommandMs: 60_000,
      log: () => {},
      alert: () => {},
    });
    const leadView = await store.viewer(lead, { bootstrap: true });
    const initial = await store.read(lead, leadView);
    const unit = initial.payload.state.units[0];
    const scope = { kind: "ward", unitIds: [unit.id] };
    const granted = await store.grantAccess(leadView, {
      actorId: nurse,
      role: "ward",
      scope,
      expiresAt: new Date(at.getTime() + 7 * 86_400_000),
    });
    assert.equal(granted.status, 200, JSON.stringify(granted.body));
    const membershipId = granted.body.membership.id;

    // The desk's first resolve writes its "last worked as" time; its full read names the context.
    const first = await store.viewer(nurse, {});
    assert.equal(first.status, "ok");
    assert.equal(first.membershipId, membershipId);
    assert.deepEqual(first.access, engine.parseAccess("ward", scope));
    assert.equal(first.workspaceStamp?.revision, initial.revision);
    const full = await store.read(nurse, first);
    assert.equal(typeof full.accessContext, "string");

    // The poll as the HTTP handler makes it: resolve the desk, then poll. One statement in all
    // (it was three: memberships, break glass openings, then the workspace row).
    at = new Date(at.getTime() + 3_000);
    statements = 0;
    const view = await store.viewer(nurse, {});
    const polled = await store.poll(nurse, full.revision, view, full.accessContext);
    assert.equal(polled.notModified, true);
    assert.equal(polled.revision, full.revision);
    assert.equal(polled.now, engine.worldNow(initial.payload, at));
    assert.equal(statements, 1);

    // Another server's save moves the revision: the same one statement sees it, and the desk is
    // sent its full scoped board.
    await pool.query("UPDATE ward_flow.workspaces SET revision=revision+1, updated_at=$2 WHERE id=$1", [
      workspaceId,
      new Date(at.getTime() + 1),
    ]);
    const moved = await store.viewer(nurse, {});
    assert.equal(moved.workspaceStamp?.revision, full.revision + 1);
    const changed = await store.poll(nurse, full.revision, moved, full.accessContext);
    assert.equal(changed.notModified, false);
    assert.equal(changed.snapshot.revision, full.revision + 1);
    // That full read keeps the new row's clock, so the next unchanged poll is one statement again.
    statements = 0;
    const again = await store.poll(
      nurse,
      changed.snapshot.revision,
      await store.viewer(nurse, {}),
      changed.snapshot.accessContext,
    );
    assert.equal(again.notModified, true);
    assert.equal(statements, 1);

    // A break glass opening comes back in the same statement: the desk's context changes and the
    // poll sends its full board, as a separate break glass read did.
    const outside = changed.snapshot.payload.state.patients.map((/** @type {any} */ patient) => patient.id);
    const patient = initial.payload.state.patients.find((/** @type {any} */ row) => !outside.includes(row.id));
    assert.ok(patient, "the seeded world has a patient outside this ward");
    const opened = await store.breakGlass(moved, patient.id, engine.BREAK_GLASS_REASON_IDS[0]);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    const withGrant = await store.viewer(nurse, {});
    assert.deepEqual(
      withGrant.grants.map((/** @type {any} */ grant) => grant.patientId),
      [patient.id],
    );
    assert.ok(withGrant.grants[0].until instanceof Date);
    assert.equal(withGrant.recentGrant, true);
    const afterGrant = await store.poll(nurse, opened.body.snapshot?.revision ?? 0, withGrant, full.accessContext);
    assert.equal(afterGrant.notModified, false);

    // A revoked role resolves to no desk, so no poll is answered at all.
    const revoked = await store.revokeAccess(leadView, membershipId);
    assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
    assert.equal((await store.viewer(nurse, {})).status, "none");
  },
);
