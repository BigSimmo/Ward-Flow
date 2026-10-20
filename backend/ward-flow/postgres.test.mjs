// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { once } from "node:events";
import { createHandler, listen } from "./server.mjs";
import { createSupabaseAuthenticator } from "./supabase-auth.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { MAX_DELIVERY_ATTEMPTS, createWorkspaceStore } from "./postgres.mjs";
import { pushPayload } from "./push.mjs";
import { RECEIPT_RETENTION_DAYS, pruneReceipts } from "./prune-receipts.mjs";
import { readFile } from "node:fs/promises";
import { verifyPostgresNamespace } from "./postgres-preflight.mjs";
import { verifyRuntimeRole } from "./portable-postgres.mjs";
import { LATEST_MIGRATION } from "./migrations.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");
test("real PostgreSQL: shared commands, last-bed contention, retry, audit and recovery", { skip: !url }, async (t) => {
  const engine = await import("./dist/engine.mjs");
  const pool = new Pool({ connectionString: url, max: 8 });
  let idleConnectionFailed = false;
  pool.on("error", () => {
    idleConnectionFailed = true;
  });
  const actorA = "11111111-1111-4111-8111-111111111111";
  const actorB = "22222222-2222-4222-8222-222222222222";
  const at = new Date("2026-10-07T10:00:00Z");
  const workspaceId = randomUUID();
  const storeA = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
  const storeB = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
  try {
    await migrate(pool);
    await migrate(pool);
    await storeA.ready();
    const seed = await storeA.read(actorA);
    assert.equal(seed.revision, 1);
    assert.equal(seed.dataMode, "prototype");
    assert.equal(
      (await pool.query("SELECT max(version) AS version FROM ward_flow.migrations")).rows[0].version,
      LATEST_MIGRATION,
    );
    const { rows: protectedFunctions } = await pool.query(
      "SELECT proname, proconfig FROM pg_proc WHERE oid IN ('ward_flow.protect_audit()'::regprocedure, 'ward_flow.protect_workspace_mode()'::regprocedure) ORDER BY proname",
    );
    assert.deepEqual(protectedFunctions, [
      { proname: "protect_audit", proconfig: ["search_path=pg_catalog, ward_flow"] },
      { proname: "protect_workspace_mode", proconfig: ["search_path=pg_catalog, ward_flow"] },
    ]);
    assert.ok(engine.validWorld(seed.payload));
    // Prepare two independent, valid movements targeting one allocatable secure bed.
    const world = structuredClone(seed.payload);
    const unitId = "rph-adult-secure";
    const movement = world.state.movements.find((row) => row.id === "WF-012");
    world.state.units = world.state.units.map((unit) =>
      unit.id === unitId
        ? {
            ...unit,
            empty: { ...unit.empty, value: 6, confirmedAt: 642 },
            allocatable: { ...unit.allocatable, value: 6, confirmedAt: 642 },
            allocatableLocked: 6,
          }
        : unit,
    );
    world.state.bedReleases = world.state.bedReleases.filter((release) => release.unitId !== unitId);
    world.state.movements.push({ ...structuredClone(movement), id: "WF-TEST-SECOND" });
    let prepared = world;
    for (const movementId of ["WF-012", "WF-TEST-SECOND"]) {
      for (const event of [
        {
          type: "REFER_TO_UNITS",
          role: "coordinator",
          unitIds: [unitId],
          genderPlacementReason: "A single room is available on this ward",
          genderPlacementChecked: true,
        },
        { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId },
      ]) {
        const result = engine.applyCommand(prepared, { ...event, movementId }, at);
        assert.equal(result.outcome, "accepted", "the fixture must be eligible before exercising concurrency");
        prepared = result.world;
      }
    }
    prepared.state.units = prepared.state.units.map((unit) =>
      unit.id === unitId ? { ...unit, allocatable: { ...unit.allocatable, value: 1 }, allocatableLocked: 1 } : unit,
    );
    assert.ok(engine.validWorld(prepared));
    await pool.query("UPDATE ward_flow.workspaces SET payload=$2 WHERE id=$1", [workspaceId, prepared]);
    const pull = (movementId) => ({ type: "PULL_PATIENT", role: "coordinator", now: -999, movementId, unitId });
    const commandA = randomUUID();
    const commandB = randomUUID();
    let winner;
    await t.test("two accounts competing for the last bed have exactly one winner", async () => {
      const results = await Promise.all([
        storeA.command(actorA, commandA, 1, pull("WF-012")),
        storeB.command(actorB, commandB, 1, pull("WF-TEST-SECOND")),
      ]);
      assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
      winner =
        results[0].status === 200
          ? { actor: actorA, id: commandA, movement: "WF-012", result: results[0] }
          : { actor: actorB, id: commandB, movement: "WF-TEST-SECOND", result: results[1] };
      assert.equal(winner.result.body.snapshot.revision, 2);
      const state = winner.result.body.snapshot.payload.state;
      assert.equal(state.units.find((unit) => unit.id === unitId).allocatable.value, 0);
      assert.equal(
        state.movements.filter((row) => ["WF-012", "WF-TEST-SECOND"].includes(row.id) && row.stage === "pulled").length,
        1,
      );
    });
    await t.test("a lost-response retry does not apply or audit the command twice", async () => {
      const result = await storeA.command(winner.actor, winner.id, 1, pull(winner.movement));
      assert.equal(result.status, 200);
      assert.equal(result.body.replayed, true);
      assert.equal(result.body.snapshot.revision, 2);
      const audit = await storeA.audit();
      assert.equal(audit.filter((row) => row.outcome === "accepted" && row.action === "PULL_PATIENT").length, 1);
      assert.equal(
        audit.find((row) => row.action === "PULL_PATIENT" && row.outcome === "accepted").actor_id,
        winner.actor,
      );
      const facts = audit.find((row) => row.action === "PULL_PATIENT" && row.outcome === "accepted").changes.facts;
      assert.equal(facts.units.before.find((unit) => unit.id === unitId).allocatable.value, 1);
      assert.equal(facts.units.after.find((unit) => unit.id === unitId).allocatable.value, 0);
    });
    await t.test("reusing a command ID for different content is rejected", async () => {
      assert.equal((await storeA.command(winner.actor, winner.id, 2, pull(winner.movement))).status, 422);
    });
    await t.test("reconnecting with a new store sees durable committed state", async () => {
      const restored = await createWorkspaceStore(pool, { workspaceId, engine, clock: () => at }).read(actorB);
      assert.equal(restored.revision, 2);
      assert.equal(restored.payload.state.movements.find((row) => row.id === winner.movement).stage, "pulled");
      assert.equal(restored.payload.state.units.find((row) => row.id === unitId).allocatable.confirmedAt, 642);
    });
    await t.test("audit entries cannot be changed or removed", async () => {
      await assert.rejects(
        pool.query("UPDATE ward_flow.audit SET action='FORGED' WHERE workspace_id=$1", [workspaceId]),
        /append-only/,
      );
      await assert.rejects(
        pool.query("DELETE FROM ward_flow.audit WHERE workspace_id=$1", [workspaceId]),
        /append-only/,
      );
    });
    await t.test("workspace mode cannot be relabelled and receipts retain prototype provenance", async () => {
      await assert.rejects(
        pool.query("UPDATE ward_flow.workspaces SET data_mode='live' WHERE id=$1", [workspaceId]),
        /data mode cannot be changed/,
      );
      assert.ok((await storeA.audit()).every((row) => row.data_mode === "prototype"));
      const receipts = await pool.query("SELECT data_mode FROM ward_flow.commands WHERE workspace_id=$1", [
        workspaceId,
      ]);
      assert.ok(receipts.rows.length && receipts.rows.every((row) => row.data_mode === "prototype"));
      await assert.rejects(
        pool.query(
          "INSERT INTO ward_flow.commands(workspace_id, actor_id, command_id, fingerprint, status, result, data_mode) VALUES($1,$2,$3,'test',200,'{}','live')",
          [workspaceId, actorA, randomUUID()],
        ),
        /command_workspace_mode/,
      );
    });
    await t.test("a workspace cannot be labelled live at all", async () => {
      // Invented fixture tagged live to prove the database refuses it, never real patient data.
      await assert.rejects(
        pool.query("INSERT INTO ward_flow.workspaces(id,revision,payload,data_mode) VALUES($1,1,$2,'live')", [
          randomUUID(),
          seed.payload,
        ]),
        /workspaces_data_mode_check/,
      );
    });
    await t.test("audit failure rolls back the workflow state and receipt", async () => {
      const failingId = randomUUID();
      await pool.query(
        "CREATE FUNCTION ward_flow.test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END $$",
      );
      await pool.query(
        "CREATE TRIGGER test_fail_audit BEFORE INSERT ON ward_flow.audit FOR EACH ROW EXECUTE FUNCTION ward_flow.test_fail_audit()",
      );
      try {
        await assert.rejects(
          storeA.command(actorA, failingId, 2, { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId }),
          /injected audit failure/,
        );
        assert.equal((await storeA.read(actorA)).revision, 2);
        assert.equal(
          (await pool.query("SELECT * FROM ward_flow.commands WHERE command_id=$1", [failingId])).rowCount,
          0,
        );
      } finally {
        await pool.query("DROP TRIGGER test_fail_audit ON ward_flow.audit");
        await pool.query("DROP FUNCTION ward_flow.test_fail_audit()");
      }
    });
  } finally {
    await pool.end();
    assert.equal(idleConnectionFailed, false, "PostgreSQL test pool reported an idle connection failure");
  }
});

test(
  "real PostgreSQL: phone push announces each new act-now item once, to other coordinators",
  { skip: !url },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 4 });
    const actorA = "11111111-1111-4111-8111-111111111111";
    const actorB = "22222222-2222-4222-8222-222222222222";
    const formerCoordinator = "55555555-5555-4555-8555-555555555555";
    const start = Date.parse("2026-10-07T10:00:00Z");
    let at = new Date(start);
    const workspaceId = randomUUID();
    const sent = [];
    const outcome = { e2: "expired" };
    const logs = [];
    const store = createWorkspaceStore(pool, {
      // The tests move the clock with the demo control, so it is switched on here.
      demoEvents: true,
      workspaceId,
      engine,
      clock: () => at,
      log: (event) => logs.push(event),
      deliveryWaitMs: 10_000,
      push: {
        send: async (row, payload) => {
          const name = row.endpoint.split("/").pop();
          sent.push({ name, payload });
          return { outcome: outcome[name] ?? "sent" };
        },
        payload: pushPayload,
        coordinatorIds: [actorA, actorB],
        maxPerAccount: 2,
      },
    });
    const device = (name) => ({
      endpoint: `https://fcm.googleapis.com/fcm/send/${name}`,
      p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString("base64url"),
      auth: Buffer.alloc(16, 2).toString("base64url"),
    });
    const delivered = () =>
      sent
        .splice(0)
        .map((entry) => entry.name)
        .sort();
    try {
      await migrate(pool);
      await store.ready();
      await store.read(actorA);
      assert.equal(await store.subscribe(actorA, device("e1")), "subscribed");
      assert.equal(await store.subscribe(actorB, device("e2")), "subscribed");
      assert.equal(await store.subscribe(actorB, device("e3")), "subscribed");
      assert.equal(await store.subscribe(actorB, device("e3")), "subscribed", "re-subscribing a device is idempotent");
      assert.equal(await store.subscribe(actorB, device("e5")), "limit");
      // An account removed from the coordinator list keeps no alerts, even with a stored device.
      assert.equal(await store.subscribe(formerCoordinator, device("e4")), "subscribed");

      const jump = { type: "ADVANCE_CLOCK", role: "demo", minutes: 30 };
      const commandId = randomUUID();
      assert.equal((await store.command(actorA, commandId, 1, jump)).status, 200);
      assert.deepEqual(delivered(), ["e2", "e3"], "the acting account and a former coordinator are not sent");
      const removed = await pool.query("SELECT endpoint FROM ward_flow.push_subscriptions WHERE endpoint LIKE '%/e2'");
      assert.equal(removed.rowCount, 0, "a 410 subscription is removed");
      const success = await pool.query(
        "SELECT last_success_at FROM ward_flow.push_subscriptions WHERE endpoint LIKE '%/e3'",
      );
      assert.ok(success.rows[0].last_success_at);

      assert.equal((await store.command(actorA, commandId, 1, jump)).body.replayed, true);
      const refresh = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: "rph-adult-secure" };
      assert.equal((await store.command(actorA, randomUUID(), 2, refresh)).status, 200);
      assert.deepEqual(delivered(), [], "a retry or a change with no new red item sends nothing");

      at = new Date(start + 30 * 60_000);
      await store.sweepPush();
      const swept = sent.slice();
      assert.deepEqual(delivered(), ["e1", "e3"], "time alone can raise a red item; every coordinator is told");
      await store.sweepPush();
      assert.deepEqual(delivered(), [], "an item still red is not announced twice");
      for (const { payload } of swept) assert.doesNotMatch(JSON.stringify(payload), /WF-|PT-|UM\d/);

      assert.equal(await store.pushStatus(actorB, device("e3").endpoint), true);
      assert.equal(await store.pushStatus(actorA, device("e3").endpoint), false, "ownership is per account");
      assert.equal(await store.unsubscribe(actorA, device("e3").endpoint), "not-found", "only the owner can revoke");
      assert.equal(
        await store.subscribe(actorA, { ...device("e3"), auth: "someone-elses-secret" }),
        "in-use",
        "a clashing endpoint without the device's own keys is refused",
      );
      assert.equal(await store.pushStatus(actorB, device("e3").endpoint), true, "the owner's record is untouched");
      assert.equal(await store.unsubscribe(actorB, device("e3").endpoint), "unsubscribed");
      assert.equal(await store.subscribe(actorA, device("e3")), "subscribed", "a revoked device can be taken over");
      assert.equal(await store.pushStatus(actorA, device("e3").endpoint), true);
      assert.equal(await store.unsubscribe(actorA, device("e3").endpoint), "unsubscribed");
      at = new Date(start + 90 * 60_000);
      await store.sweepPush();
      assert.deepEqual(delivered(), ["e1"]);
      assert.equal(await store.pushStatus(actorB, device("e3").endpoint), false, "a revoked record is not owned");
      assert.deepEqual(logs, [], "nothing failed, so nothing is logged");
    } finally {
      await pool.end();
    }
  },
);

test(
  "real PostgreSQL: phone push reaches every device, retries failures and never costs a change",
  { skip: !url },
  async (t) => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 4 });
    const actorA = "11111111-1111-4111-8111-111111111111";
    const actorB = "22222222-2222-4222-8222-222222222222";
    const at = new Date("2026-10-07T10:00:00Z");
    const jump = { type: "ADVANCE_CLOCK", role: "demo", minutes: 30 };
    const keys = { p256dh: "p", auth: "a" };
    function setup(options = {}) {
      const workspaceId = randomUUID();
      const sent = [];
      const logs = [];
      const store = createWorkspaceStore(pool, {
        // The tests move the clock with the demo control, so it is switched on here.
        demoEvents: true,
        workspaceId,
        engine: options.engine ?? engine,
        clock: () => at,
        log: (event) => logs.push(event),
        deliveryWaitMs: options.deliveryWaitMs ?? 10_000,
        // No gap between retries here, so a sweep can retry at once on the fixed clock.
        retryAfterMs: 0,
        push: {
          send: async (row, payload) => {
            sent.push(row.endpoint.split("/").pop());
            return (await options.send?.(row, payload)) ?? { outcome: "sent" };
          },
          payload: pushPayload,
          coordinatorIds: [actorA, actorB],
          maxPerAccount: 10,
        },
      });
      // Each case reuses the same device names in its own workspace. A device is only ever taken
      // over once its earlier owner has turned alerts off, so the earlier cases' records are
      // revoked first, as that owner's sign-out would.
      const subscribe = store.subscribe;
      store.subscribe = async (actorId, subscription) => {
        await pool.query(
          "UPDATE ward_flow.push_subscriptions SET revoked_at=now() WHERE endpoint=$1 AND workspace_id<>$2 AND revoked_at IS NULL",
          [subscription.endpoint, workspaceId],
        );
        return subscribe(actorId, subscription);
      };
      return { workspaceId, sent, logs, store };
    }
    try {
      await migrate(pool);
      await t.test("more than one page of subscriptions: every device is sent", async () => {
        const { workspaceId, sent, store } = setup();
        await store.read(actorA);
        await pool.query(
          "INSERT INTO ward_flow.push_subscriptions(workspace_id, actor_id, endpoint, p256dh, auth) SELECT $1::uuid, $2::uuid, 'https://fcm.googleapis.com/fcm/send/' || $1::text || '-' || n, 'p', 'a' FROM generate_series(1, 205) AS n",
          [workspaceId, actorB],
        );
        assert.equal((await store.command(actorA, randomUUID(), 1, jump)).status, 200);
        assert.equal(new Set(sent).size, 205);
        assert.equal(sent.length, 205);
      });
      const subscribeTwo = async (store) => {
        await store.read(actorA);
        await store.subscribe(actorB, { endpoint: "https://fcm.googleapis.com/fcm/send/f1", ...keys });
        await store.subscribe(actorB, { endpoint: "https://fcm.googleapis.com/fcm/send/f2", ...keys });
      };
      const statuses = async (workspaceId) =>
        (
          await pool.query(
            "SELECT DISTINCT split_part(s.endpoint, '/', 6) AS device, d.status, d.attempts FROM ward_flow.push_deliveries d JOIN ward_flow.push_subscriptions s ON s.id = d.subscription_id WHERE s.workspace_id=$1 ORDER BY 1",
            [workspaceId],
          )
        ).rows.map((row) => `${row.device} ${row.status} ${row.attempts}`);
      await t.test("one device that keeps refusing (403) is not retried, and no other device is resent", async () => {
        const { workspaceId, sent, logs, store } = setup({
          send: async (row) =>
            row.endpoint.endsWith("/f1") ? { outcome: "failed", category: "status 403", retry: false } : undefined,
        });
        await subscribeTwo(store);
        assert.equal((await store.command(actorA, randomUUID(), 1, jump)).status, 200);
        assert.deepEqual(sent.splice(0).sort(), ["f1", "f2"]);
        await store.sweepPush();
        await store.sweepPush();
        assert.deepEqual(sent, [], "neither the refusing device nor the other is sent again");
        assert.deepEqual(await statuses(workspaceId), ["f1 failed 1", "f2 sent 1"]);
        assert.equal(logs.length, 1);
      });
      await t.test("an interrupted delivery left pending is sent by the next sweep", async () => {
        let hang = true;
        // The command stops waiting after 50 ms whether or not the sends have begun, so the test
        // waits for both sends to start rather than assuming 50 ms was long enough.
        let bothStarted;
        const started = new Promise((resolve) => {
          bothStarted = resolve;
        });
        const { workspaceId, sent, store } = setup({
          deliveryWaitMs: 50,
          send: async () => {
            if (!hang) return undefined;
            if (sent.length === 2) bothStarted();
            return new Promise(() => {});
          },
        });
        await subscribeTwo(store);
        assert.equal((await store.command(actorA, randomUUID(), 1, jump)).status, 200);
        await started;
        assert.deepEqual(sent.splice(0).sort(), ["f1", "f2"], "sends started, then the instance stopped");
        assert.deepEqual(await statuses(workspaceId), ["f1 pending 1", "f2 pending 1"]);
        hang = false;
        await store.sweepPush();
        assert.deepEqual(sent.splice(0).sort(), ["f1", "f2"]);
        assert.deepEqual(await statuses(workspaceId), ["f1 sent 2", "f2 sent 2"]);
      });
      await t.test("a device that keeps failing temporarily stops after the attempts cap", async () => {
        const { workspaceId, sent, store } = setup({
          send: async (row) =>
            row.endpoint.endsWith("/f1") ? { outcome: "failed", category: "status 503", retry: true } : undefined,
        });
        await subscribeTwo(store);
        assert.equal((await store.command(actorA, randomUUID(), 1, jump)).status, 200);
        for (let sweep = 0; sweep < MAX_DELIVERY_ATTEMPTS + 2; sweep += 1) await store.sweepPush();
        assert.equal(sent.filter((name) => name === "f1").length, MAX_DELIVERY_ATTEMPTS);
        assert.equal(sent.filter((name) => name === "f2").length, 1);
        assert.deepEqual(await statuses(workspaceId), [`f1 failed ${MAX_DELIVERY_ATTEMPTS}`, "f2 sent 1"]);
      });
      await t.test("a temporary failure is retried by the next sweep; the log names no device", async () => {
        let fail = true;
        const { sent, logs, store } = setup({
          send: async (row) =>
            fail && row.endpoint.endsWith("/f1")
              ? { outcome: "failed", category: "status 429", retry: true }
              : undefined,
        });
        await store.read(actorA);
        await store.subscribe(actorB, { endpoint: "https://fcm.googleapis.com/fcm/send/f1", ...keys });
        await store.subscribe(actorB, { endpoint: "https://fcm.googleapis.com/fcm/send/f2", ...keys });
        assert.equal((await store.command(actorA, randomUUID(), 1, jump)).status, 200);
        assert.deepEqual(sent.splice(0).sort(), ["f1", "f2"]);
        assert.deepEqual(logs, [
          {
            event: "ward_backend_push_delivery_failures",
            sent: 1,
            expired: 0,
            failed: 1,
            failures: { "status 429": 1 },
          },
        ]);
        assert.doesNotMatch(JSON.stringify(logs), /fcm|https?:|Ward Flow:/);
        fail = false;
        await store.sweepPush();
        assert.deepEqual(sent.splice(0), ["f1"], "only the device that failed is retried");
        await store.sweepPush();
        assert.deepEqual(sent, [], "announced once delivery succeeded");
      });
      await t.test("a delivery holding a stale read never drops or empties a freshly queued alert", async () => {
        // deliver() reads the world without a lock, so a commit can queue an item it has not seen.
        // Simulate that read with an engine whose next alert list (the delivery's) comes back empty.
        let stale = false;
        let fail = true;
        const lagging = {
          ...engine,
          actNowAlerts: (world, at) => {
            if (stale) {
              stale = false;
              return [];
            }
            return engine.actNowAlerts(world, at);
          },
        };
        const { workspaceId, sent, store } = setup({
          engine: lagging,
          send: async (row) =>
            fail && row.endpoint.endsWith("/f1")
              ? { outcome: "failed", category: "status 503", retry: true }
              : undefined,
        });
        await subscribeTwo(store);
        assert.equal((await store.command(actorA, randomUUID(), 1, jump)).status, 200);
        assert.deepEqual(sent.splice(0).sort(), ["f1", "f2"]);
        assert.deepEqual(await statuses(workspaceId), ["f1 pending 1", "f2 sent 1"]);
        fail = false;
        // The sweep's evaluation (under the lock) sees the item; its delivery reads are stale.
        const realAlerts = engine.actNowAlerts;
        let calls = 0;
        let staleReads = [2];
        lagging.actNowAlerts = (world, at) => {
          calls += 1;
          return staleReads.includes(calls) ? [] : realAlerts(world, at);
        };
        await store.sweepPush();
        assert.deepEqual(sent.splice(0), [], "nothing is sent for an item the delivery read has not seen");
        assert.deepEqual(await statuses(workspaceId), ["f1 pending 1", "f2 sent 1"], "the row is kept, unclaimed");
        calls = 0;
        staleReads = [];
        await store.sweepPush();
        assert.deepEqual(sent.splice(0), ["f1"], "the next delivery sends it");
        assert.deepEqual(await statuses(workspaceId), ["f1 sent 2", "f2 sent 1"]);
      });
      await t.test("a device signed in again drops its earlier pending alerts", async () => {
        const { workspaceId, sent, store } = setup({
          send: async (row) =>
            row.endpoint.endsWith("/f1") ? { outcome: "failed", category: "status 503", retry: true } : undefined,
        });
        await subscribeTwo(store);
        assert.equal((await store.command(actorA, randomUUID(), 1, jump)).status, 200);
        assert.deepEqual(sent.splice(0).sort(), ["f1", "f2"]);
        assert.deepEqual(await statuses(workspaceId), ["f1 pending 1", "f2 sent 1"]);
        // Another coordinator cannot take the device while its owner's alerts are still on.
        const f1 = { endpoint: "https://fcm.googleapis.com/fcm/send/f1", ...keys };
        assert.equal(await store.subscribe(actorA, { ...f1, auth: "not-this-device" }), "in-use");
        assert.deepEqual(await statuses(workspaceId), ["f1 pending 1", "f2 sent 1"], "the owner's rows are untouched");
        // The owner's sign-out never reached the server; the device itself, holding its own keys,
        // can still be taken over before the retry.
        assert.equal(await store.subscribe(actorA, f1), "subscribed");
        assert.equal(await store.pushStatus(actorB, f1.endpoint), false, "the old owner no longer holds it");
        await store.sweepPush();
        assert.deepEqual(sent, [], "an item queued before the device changed hands is not sent");
        assert.deepEqual(await statuses(workspaceId), ["f2 sent 1"]);
      });
      await t.test("an evaluation error is logged and the command still commits", async () => {
        const broken = {
          ...engine,
          actNowAlerts: () => {
            throw Object.assign(new TypeError("unexpected state"), { code: "ENGINE" });
          },
        };
        const { sent, logs, store } = setup({ engine: broken });
        await store.read(actorA);
        await store.subscribe(actorB, { endpoint: "https://fcm.googleapis.com/fcm/send/b1", ...keys });
        const result = await store.command(actorA, randomUUID(), 1, jump);
        assert.equal(result.status, 200);
        assert.equal(result.body.snapshot.revision, 2);
        assert.equal((await store.read(actorA)).revision, 2);
        assert.deepEqual(sent, []);
        assert.deepEqual(logs, [
          {
            event: "ward_backend_push_evaluation_failure",
            errorName: "TypeError",
            errorCode: "ENGINE",
          },
        ]);
      });
      await t.test("a slow push service does not hold the save response", async () => {
        /** @type {(value: unknown) => void} */
        let release;
        const held = new Promise((resolve) => {
          release = resolve;
        });
        let sendStarted;
        const started = new Promise((resolve) => {
          sendStarted = resolve;
        });
        const { workspaceId, sent, store } = setup({
          deliveryWaitMs: 50,
          send: async () => {
            sendStarted();
            return held;
          },
        });
        await store.read(actorA);
        await store.subscribe(actorB, { endpoint: "https://fcm.googleapis.com/fcm/send/s1", ...keys });
        // The send is held until after the command returns, so returning at all proves the save
        // response did not wait for delivery.
        assert.equal((await store.command(actorA, randomUUID(), 1, jump)).status, 200);
        await started;
        assert.deepEqual(sent, ["s1"], "delivery had started");
        assert.deepEqual(await statuses(workspaceId), ["s1 pending 1"], "not yet delivered when the save returned");
        release({ outcome: "sent" });
        // Wait for the background delivery to record the send, so it never outlives the pool.
        for (let tries = 0; tries < 200; tries += 1) {
          if ((await statuses(workspaceId))[0] === "s1 sent 1") break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.deepEqual(await statuses(workspaceId), ["s1 sent 1"]);
      });
    } finally {
      await pool.end();
    }
  },
);

// In this file, not its own, so it never runs alongside the injected audit failure above.
test(
  "real PostgreSQL: lean polls, revision-only replies, demo controls and receipt pruning",
  { skip: !url },
  async (t) => {
    const actor = "11111111-1111-4111-8111-111111111111";
    const refresh = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: "rph-adult-secure" };
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 4 });
    let at = new Date("2026-10-07T10:00:00Z");
    const store = (options = {}) =>
      createWorkspaceStore(pool, {
        workspaceId: options.workspaceId ?? randomUUID(),
        engine,
        clock: () => at,
        ...options,
      });
    try {
      await migrate(pool);
      await t.test("an unchanged workspace answers the poll with its revision and moving clock only", async () => {
        const shared = store();
        const first = await shared.read(actor);
        const polled = await shared.poll(actor, first.revision);
        assert.deepEqual(polled, { notModified: true, dataMode: "prototype", revision: 1, now: first.now });
        at = new Date(at.getTime() + 5 * 60_000);
        assert.equal((await shared.poll(actor, 1)).now, first.now + 5);
        const stale = await shared.poll(actor, 99);
        assert.equal(stale.notModified, false);
        assert.equal(stale.snapshot.revision, 1);
        assert.ok(engine.validWorld(stale.snapshot.payload));
      });
      await t.test("an accepted command can answer with its revision only; a replay does too", async () => {
        const shared = store();
        await shared.read(actor);
        const commandId = randomUUID();
        const lean = await shared.command(actor, commandId, 1, refresh, { revisionOnly: true });
        assert.equal(lean.status, 200);
        assert.equal(lean.body.commandRevision, 2);
        assert.equal(lean.body.snapshot, undefined);
        const replay = await shared.command(actor, commandId, 1, refresh, { revisionOnly: true });
        assert.equal(replay.body.replayed, true);
        assert.equal(replay.body.snapshot, undefined);
        const full = await shared.command(actor, commandId, 1, refresh);
        assert.equal(full.body.snapshot.revision, 2);
        // A save made against an older revision still applies when nobody else changed its records,
        // and is refused when they did.
        const unitId = refresh.unitId;
        const unit = full.body.snapshot.payload.state.units.find((row) => row.id === unitId);
        const confirm = {
          type: "CONFIRM_CAPACITY",
          role: "ward",
          unitId,
          actingUnitId: unitId,
          value: unit.allocatable.value,
          expectedRevision: unit.allocatable.revision ?? 0,
        };
        const kept = await shared.command(actor, randomUUID(), 1, confirm, { revisionOnly: true });
        assert.equal(kept.status, 200);
        assert.equal(kept.body.commandRevision, 3);
        const stale = await shared.command(actor, randomUUID(), 2, confirm, { revisionOnly: true });
        assert.equal(stale.status, 409);
        assert.match(stale.body.error, /Someone else changed this record first/);
        assert.equal(stale.body.snapshot.revision, 3, "a stale command always carries the board");
      });
      await t.test("demo controls are refused on the shared workspace unless switched on", async () => {
        const jump = { type: "ADVANCE_CLOCK", role: "demo", minutes: 30 };
        const off = store();
        await off.read(actor);
        const commandId = randomUUID();
        const refused = await off.command(actor, commandId, 1, jump);
        assert.equal(refused.status, 422);
        assert.equal(refused.body.outcome, "denied");
        assert.equal(refused.body.snapshot.demoControls, false, "the screens can tell the controls are off");
        assert.equal((await off.read(actor)).revision, 1, "nothing was saved");
        const audited = await pool.query("SELECT outcome FROM ward_flow.audit WHERE command_id=$1", [commandId]);
        assert.deepEqual(audited.rows, [{ outcome: "denied" }], "the refused attempt is audited");
        assert.equal((await off.command(actor, commandId, 1, jump)).body.replayed, true, "a retry replays it");
        const on = store({ demoEvents: true });
        assert.equal((await on.read(actor)).demoControls, true);
        assert.equal((await on.command(actor, randomUUID(), 1, jump)).status, 200);
      });
      await t.test("receipts older than the retention window are pruned; newer ones stay", async () => {
        const shared = store();
        await shared.read(actor);
        const old = randomUUID();
        await shared.command(actor, old, 1, refresh);
        await shared.command(actor, randomUUID(), 2, refresh);
        await pool.query(
          "UPDATE ward_flow.commands SET committed_at = now() - make_interval(days => $2) WHERE command_id=$1",
          [old, RECEIPT_RETENTION_DAYS + 1],
        );
        assert.ok((await pruneReceipts(pool)) >= 1);
        const { rows } = await pool.query(
          "SELECT command_id FROM ward_flow.commands WHERE command_id = ANY($1::uuid[])",
          [[old]],
        );
        assert.deepEqual(rows, []);
        const kept = await pool.query(
          "SELECT count(*)::int AS count FROM ward_flow.commands WHERE committed_at > now() - interval '1 day'",
        );
        assert.ok(kept.rows[0].count >= 1);
        await assert.rejects(pruneReceipts(pool, { days: 0 }), /retention/);
      });
    } finally {
      await pool.end();
    }
  },
);

test(
  "real PostgreSQL: row-level security lets only the runtime role through, and 012, 011, 010, 009, 008, 007 then 006 roll back to 5",
  { skip: !url },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const admin = new Pool({ connectionString: url, max: 2 });
    const database = `wardflow_rls_${randomUUID().replaceAll("-", "")}`;
    const target = new URL(url);
    target.pathname = `/${database}`;
    // Each pool acts as one role from the start of every connection, as the real logins do. The
    // forced drop at the end can reach a connection that is still closing; that notice is expected
    // and is not left to fail the run (query errors still reject as usual).
    const as = (role) => {
      const pool = new Pool({ connectionString: target.href, max: 2, ...(role && { options: `-c role=${role}` }) });
      pool.on("error", () => {});
      return pool;
    };
    const pools = [];
    const sql = (name) => readFile(new URL(name, import.meta.url), "utf8");
    const actor = "11111111-1111-4111-8111-111111111111";
    const refresh = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: "rph-adult-secure" };
    const runtimeOk = (pool) => verifyRuntimeRole(pool, "wardflow_backend", true, "unavailable", "unsafe");
    await admin.query(`CREATE DATABASE ${database}`);
    try {
      const owner = as();
      const runtime = as("wardflow_backend");
      pools.push(owner, runtime);
      await verifyPostgresNamespace(owner);
      await migrate(owner);
      await owner.query(await sql("./infra/postgres-runtime-role.sql"));
      await verifyPostgresNamespace(owner);
      const { rows: tables } = await owner.query(
        "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace='ward_flow'::regnamespace AND relkind='r' ORDER BY relname",
      );
      assert.equal(tables.length, 13);
      assert.ok(tables.every((row) => row.relrowsecurity && !row.relforcerowsecurity));

      await runtimeOk(runtime);
      const store = createWorkspaceStore(runtime, { workspaceId: randomUUID(), engine, demoEvents: true });
      await store.ready();
      await store.read(actor);
      assert.equal((await store.command(actor, randomUUID(), 1, refresh)).status, 200);
      // The backend can approve or end a role, never rewrite who holds it, what it is, or where.
      await runtime.query(
        "UPDATE ward_flow.memberships SET revoked_at=now(), revoked_by=gen_random_uuid() WHERE false",
      );
      await assert.rejects(
        runtime.query("UPDATE ward_flow.memberships SET role='admin' WHERE false"),
        /permission denied/,
      );
      await assert.rejects(
        runtime.query("UPDATE ward_flow.memberships SET expires_at=now() WHERE false"),
        /permission denied/,
      );
      // From 9 it may also note when a role was last used, and answer a request once, nothing more.
      // A grant missing or too wide either way fails the startup check.
      for (const [change, undo] of [
        ["GRANT UPDATE (kind) ON ward_flow.memberships", "REVOKE UPDATE (kind) ON ward_flow.memberships"],
        ["GRANT UPDATE (role) ON ward_flow.access_requests", "REVOKE UPDATE (role) ON ward_flow.access_requests"],
        [
          "REVOKE UPDATE (last_used_at) ON ward_flow.memberships",
          "GRANT UPDATE (last_used_at) ON ward_flow.memberships",
        ],
        ["REVOKE INSERT ON ward_flow.access_requests", "GRANT INSERT ON ward_flow.access_requests"],
        // From 10 it adds, rewrites and removes record rows, and may not empty or reference the table.
        ["REVOKE DELETE ON ward_flow.workspace_records", "GRANT DELETE ON ward_flow.workspace_records"],
        ["GRANT TRUNCATE ON ward_flow.workspace_records", "REVOKE TRUNCATE ON ward_flow.workspace_records"],
      ]) {
        await owner.query(`${change} ${change.startsWith("GRANT") ? "TO" : "FROM"} wardflow_backend`);
        await assert.rejects(runtimeOk(runtime), /unsafe/, change);
        await owner.query(`${undo} ${undo.startsWith("GRANT") ? "TO" : "FROM"} wardflow_backend`);
      }
      await runtimeOk(runtime);
      await runtime.query("UPDATE ward_flow.memberships SET last_used_at=now() WHERE false");
      await assert.rejects(
        runtime.query("UPDATE ward_flow.memberships SET kind='cover' WHERE false"),
        /permission denied/,
      );
      await runtime.query(
        "UPDATE ward_flow.access_requests SET decision='declined', decided_by=gen_random_uuid(), decided_at=now() WHERE false",
      );
      await assert.rejects(
        runtime.query("UPDATE ward_flow.access_requests SET role='admin' WHERE false"),
        /permission denied/,
      );
      // From 10 record openings are only added and read, and even the owner cannot change them.
      // A lapsed sign-out may be removed; nothing in one changes.
      await assert.rejects(
        runtime.query("UPDATE ward_flow.record_access SET patient_id='PT-0' WHERE false"),
        /permission denied/,
      );
      await assert.rejects(runtime.query("DELETE FROM ward_flow.record_access WHERE false"), /permission denied/);
      await assert.rejects(owner.query("DELETE FROM ward_flow.record_access WHERE false"), /append-only/);
      await assert.rejects(owner.query("UPDATE ward_flow.break_glass SET reason='other' WHERE false"), /append-only/);
      await runtime.query("DELETE FROM ward_flow.session_sign_outs WHERE false");
      await assert.rejects(
        runtime.query("UPDATE ward_flow.session_sign_outs SET until=now() WHERE false"),
        /permission denied/,
      );
      for (const [change, undo] of [
        ["GRANT UPDATE (surface) ON ward_flow.record_access", "REVOKE UPDATE (surface) ON ward_flow.record_access"],
        ["REVOKE DELETE ON ward_flow.session_sign_outs", "GRANT DELETE ON ward_flow.session_sign_outs"],
      ]) {
        await owner.query(`${change} ${change.startsWith("GRANT") ? "TO" : "FROM"} wardflow_backend`);
        await assert.rejects(runtimeOk(runtime), /unsafe/, change);
        await owner.query(`${undo} ${undo.startsWith("GRANT") ? "TO" : "FROM"} wardflow_backend`);
      }
      await runtimeOk(runtime);

      // A role with a grant it should never have still sees and writes nothing.
      await owner.query("DROP ROLE IF EXISTS wardflow_rls_probe");
      await owner.query("CREATE ROLE wardflow_rls_probe NOLOGIN");
      await owner.query(
        "GRANT USAGE ON SCHEMA ward_flow TO wardflow_rls_probe; GRANT SELECT, INSERT ON ward_flow.workspaces, ward_flow.audit, ward_flow.workspace_records TO wardflow_rls_probe",
      );
      const probe = as("wardflow_rls_probe");
      pools.push(probe);
      assert.equal((await probe.query("SELECT count(*)::int AS n FROM ward_flow.workspaces")).rows[0].n, 0);
      assert.equal((await probe.query("SELECT count(*)::int AS n FROM ward_flow.audit")).rows[0].n, 0);
      assert.equal((await probe.query("SELECT count(*)::int AS n FROM ward_flow.workspace_records")).rows[0].n, 0);
      await assert.rejects(
        probe.query("INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES (gen_random_uuid(), 1, '{}')"),
        /row-level security/,
      );
      await probe.end();
      pools.pop();
      await owner.query(
        "REVOKE ALL ON ward_flow.workspaces, ward_flow.audit, ward_flow.workspace_records FROM wardflow_rls_probe",
      );
      await owner.query("REVOKE ALL ON SCHEMA ward_flow FROM wardflow_rls_probe; DROP ROLE wardflow_rls_probe");

      // Each rollback, newest first, takes the database back one step and the same backend keeps
      // working at every step. After 007's, a live label is allowed again, exactly as before.
      const rollBack = async (file) => {
        const client = await owner.connect();
        try {
          await client.query("BEGIN");
          await client.query(await sql(file));
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      };
      // Out of order, each rollback refuses and changes nothing, so the ledger never has a gap.
      await assert.rejects(
        rollBack("./infra/rollback-006-row-level-security.sql"),
        /Roll back the newer migrations first/,
      );
      await assert.rejects(rollBack("./infra/rollback-007-prototype-only.sql"), /roll back 008 first/);
      await assert.rejects(rollBack("./infra/rollback-008-role-access.sql"), /not at migration 8/);
      await assert.rejects(rollBack("./infra/rollback-009-access-cover-requests.sql"), /not at migration 9/);
      await assert.rejects(rollBack("./infra/rollback-010-workspace-records.sql"), /not at migration 10/);
      await assert.rejects(rollBack("./infra/rollback-011-record-access-and-sign-out.sql"), /not at migration 11/);
      assert.equal((await owner.query("SELECT max(version) AS v FROM ward_flow.migrations")).rows[0].v, 12);
      let beforeRecordsRollback;
      let revision = 2;
      for (const [file, version] of [
        ["./infra/rollback-012-foreign-key-indexes.sql", 11],
        ["./infra/rollback-011-record-access-and-sign-out.sql", 10],
        ["./infra/rollback-010-workspace-records.sql", 9],
        ["./infra/rollback-009-access-cover-requests.sql", 8],
        ["./infra/rollback-008-role-access.sql", 7],
        ["./infra/rollback-007-prototype-only.sql", 6],
        ["./infra/rollback-006-row-level-security.sql", 5],
      ]) {
        if (version === 7) assert.equal((await store.viewer(actor, { bootstrap: true })).version, 8);
        if (version === 9) beforeRecordsRollback = (await store.read(actor)).payload;
        await rollBack(file);
        assert.equal((await owner.query("SELECT max(version) AS v FROM ward_flow.migrations")).rows[0].v, version);
        if (version === 7) {
          // The cached version still says 8 for one request, which fails; the next reads it again.
          await assert.rejects(store.viewer(actor), /does not exist/);
          assert.deepEqual(await store.viewer(actor), { status: "none" });
          assert.equal((await store.roleHolders()).includes(actor), false);
          // The access routes say roles need 008 rather than failing on the missing table.
          assert.equal((await store.listAccess(await store.viewer(actor, { bootstrap: true }))).status, 409);
        }
        if (version === 9) {
          // Every record is back in the workspace row, exactly as it was, and the rows table is gone.
          const { rows } = await owner.query("SELECT payload FROM ward_flow.workspaces");
          assert.deepEqual(rows[0].payload, beforeRecordsRollback);
          assert.equal((await owner.query("SELECT to_regclass('ward_flow.workspace_records') AS t")).rows[0].t, null);
          // The cached version still says 10; the read finds the table gone and reads the version again.
          assert.deepEqual((await store.read(actor)).payload, beforeRecordsRollback);
        }
        await verifyPostgresNamespace(owner);
        await runtimeOk(runtime);
        await store.ready();
        assert.equal((await store.command(actor, randomUUID(), revision++, refresh)).status, 200);
      }
      const { rows: check } = await owner.query(
        "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='workspaces_data_mode_check'",
      );
      assert.equal(check[0].def, "CHECK ((data_mode = ANY (ARRAY['prototype'::text, 'live'::text])))");
      await assert.rejects(rollBack("./infra/rollback-007-prototype-only.sql"), /not at migration 7/);

      // 007 refuses, and the whole run rolls back, while any workspace is labelled live.
      const liveId = randomUUID();
      await owner.query("INSERT INTO ward_flow.workspaces(id,revision,payload,data_mode) VALUES($1,1,'{}','live')", [
        liveId,
      ]);
      await assert.rejects(migrate(owner), /not prototype/);
      assert.equal((await owner.query("SELECT max(version) AS v FROM ward_flow.migrations")).rows[0].v, 5);
      await owner.query("DELETE FROM ward_flow.workspaces WHERE id=$1", [liveId]);

      // The runtime grants re-run cleanly on a database still at 5, before the 008 tables exist.
      await owner.query(await sql("./infra/postgres-runtime-role.sql"));
      // Re-applying 6 to 8 works once the runtime grants are run again, as setup does; a policy
      // removed afterwards is refused by both checks.
      await migrate(owner);
      await owner.query(await sql("./infra/postgres-runtime-role.sql"));
      await verifyPostgresNamespace(owner);
      await runtimeOk(runtime);
      await owner.query("DROP POLICY runtime_only ON ward_flow.audit");
      await assert.rejects(runtimeOk(runtime), /unsafe/);
      await assert.rejects(verifyPostgresNamespace(owner), /Unrecognised or unsafe/);
      // So is a same-named policy with no USING clause, whose missing expression must not read as a match.
      await owner.query("CREATE POLICY runtime_only ON ward_flow.audit WITH CHECK (current_user = 'wardflow_backend')");
      await assert.rejects(runtimeOk(runtime), /unsafe/);
      await assert.rejects(verifyPostgresNamespace(owner), /Unrecognised or unsafe/);
    } finally {
      for (const pool of pools) await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      await admin.end();
    }
  },
);

test("real PostgreSQL: the Supabase runtime grants pass the runtime role check", { skip: !url }, async () => {
  const admin = new Pool({ connectionString: url, max: 1 });
  const database = `wardflow_supa_${randomUUID().replaceAll("-", "")}`;
  const target = new URL(url);
  target.pathname = `/${database}`;
  // Supabase's browser roles, which the script revokes from by name.
  for (const role of ["anon", "authenticated"])
    await admin.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF; END $$`,
    );
  await admin.query(`CREATE DATABASE ${database}`);
  const owner = new Pool({ connectionString: target.href, max: 1 });
  const runtime = new Pool({ connectionString: target.href, max: 1, options: "-c role=wardflow_backend" });
  try {
    const grants = await readFile(new URL("./infra/supabase-runtime-role.sql", import.meta.url), "utf8");
    await migrate(owner);
    await owner.query(grants);
    await verifyRuntimeRole(runtime, "wardflow_backend", true, "unavailable", "unsafe");
  } finally {
    await owner.end();
    await runtime.end();
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
});

test(
  "real PostgreSQL: snapshot access context follows effective access and active grant expiry",
  { skip: !url },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 2 });
    let at = new Date("2026-10-07T10:00:00Z");
    const workspaceId = randomUUID();
    const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date(at) });
    const [lead, otherLead, nurse] = Array.from({ length: 3 }, () => randomUUID());
    const later = new Date("2027-01-01T00:00:00Z");
    try {
      await migrate(pool);
      const leadView = await store.viewer(lead, { bootstrap: true });
      const full = await store.read(lead, leadView);
      assert.match(full.accessContext, /^[a-f0-9]{64}$/);
      assert.equal((await store.read(lead, leadView)).accessContext, full.accessContext);
      const otherView = await store.viewer(otherLead, { bootstrap: true });
      assert.notEqual((await store.read(otherLead, otherView)).accessContext, full.accessContext);
      const otherStore = createWorkspaceStore(pool, { workspaceId: randomUUID(), engine, clock: () => new Date(at) });
      assert.notEqual(
        (await otherStore.read(lead, await otherStore.viewer(lead, { bootstrap: true }))).accessContext,
        full.accessContext,
      );
      const stay = full.payload.state.admissions.find((row) => row.patientId !== null && row.leftAt === null);
      const ward = { kind: "ward", unitIds: [stay.unitId] };
      const membership = await store.grantAccess(leadView, {
        actorId: nurse,
        role: "ward",
        scope: ward,
        expiresAt: later,
      });
      assert.equal(membership.status, 200);
      const nurseView = await store.viewer(nurse);
      const scoped = await store.read(nurse, nurseView);
      assert.match(scoped.accessContext, /^[a-f0-9]{64}$/);
      assert.notEqual(scoped.accessContext, full.accessContext);
      at = new Date(at.getTime() + 60_000);
      const clockOnly = await store.read(nurse, nurseView);
      assert.equal(clockOnly.revision, scoped.revision);
      assert.equal(
        clockOnly.accessContext,
        scoped.accessContext,
        "ordinary clock changes retain a frozen report's context",
      );

      const unit = scoped.payload.state.units.find((row) => row.id === stay.unitId);
      const commandId = randomUUID();
      const event = {
        type: "CONFIRM_CAPACITY",
        role: "ward",
        actingUnitId: stay.unitId,
        unitId: stay.unitId,
        expectedRevision: unit.allocatable.revision ?? 0,
        value: unit.allocatable.value,
      };
      const saved = await store.command(nurse, commandId, scoped.revision, event, { view: nurseView });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.snapshot.revision, scoped.revision + 1);
      assert.equal(
        saved.body.snapshot.accessContext,
        scoped.accessContext,
        "clinical revision is independent of access context",
      );

      const outsiders = full.payload.state.patients.filter(
        (row) => !scoped.payload.state.patients.some((own) => own.id === row.id),
      );
      assert.ok(outsiders.length >= 2);
      const opened = await store.breakGlass(nurseView, outsiders[0].id, "handover");
      assert.equal(opened.status, 200);
      assert.equal(opened.body.snapshot.revision, saved.body.snapshot.revision);
      assert.notEqual(opened.body.snapshot.accessContext, scoped.accessContext);
      const granted = await store.read(nurse, nurseView);
      assert.equal(granted.accessContext, opened.body.snapshot.accessContext);
      // The same patient's absolute expiry matters too: canonical(Date) alone would turn both into {}.
      // Break glass rows are append-only from migration 11, so the test lifts the guard for this one edit.
      await pool.query("ALTER TABLE ward_flow.break_glass DISABLE TRIGGER protect_break_glass");
      await pool.query(
        "UPDATE ward_flow.break_glass SET until=until + interval '1 second' WHERE workspace_id=$1 AND actor_id=$2 AND patient_id=$3",
        [workspaceId, nurse, outsiders[0].id],
      );
      await pool.query("ALTER TABLE ward_flow.break_glass ENABLE TRIGGER protect_break_glass");
      const extended = await store.read(nurse, nurseView);
      assert.notEqual(extended.accessContext, granted.accessContext);
      assert.equal(extended.revision, granted.revision);
      at = new Date(at.getTime() + 2_000);
      const secondOpening = await store.breakGlass(nurseView, outsiders[1].id, "handover");
      assert.equal(secondOpening.status, 200);
      // Opening appends to the view's grants; the SQL viewer reads them newest-first. Order is immaterial.
      const union = await store.read(nurse, nurseView);
      assert.equal(union.accessContext, secondOpening.body.snapshot.accessContext);
      assert.notEqual(union.accessContext, extended.accessContext);
      const replay = await store.command(nurse, commandId, scoped.revision, event, { view: nurseView });
      assert.equal(replay.body.replayed, true);
      assert.equal(
        replay.body.snapshot.accessContext,
        union.accessContext,
        "receipt replay carries the latest access context",
      );

      at = new Date(at.getTime() + (engine.BREAK_GLASS_MINUTES + 2) * 60_000);
      const expired = await store.read(nurse, nurseView);
      assert.equal(expired.revision, union.revision);
      assert.equal(expired.accessContext, scoped.accessContext);
      assert.notEqual(expired.accessContext, union.accessContext);
      const expiredReplay = await store.command(nurse, commandId, scoped.revision, event, { view: nurseView });
      assert.equal(expiredReplay.body.snapshot.accessContext, expired.accessContext);
      const secondMembership = await store.grantAccess(leadView, {
        actorId: nurse,
        role: "ward",
        scope: ward,
        expiresAt: later,
      });
      assert.equal(secondMembership.status, 200);
      const secondDesk = await store.viewer(nurse, { workingAs: secondMembership.body.membership.id });
      assert.notEqual((await store.read(nurse, secondDesk)).accessContext, expired.accessContext);
      const extraUnit = full.payload.state.units.find((row) => row.id !== stay.unitId).id;
      await pool.query("UPDATE ward_flow.memberships SET scope=$2 WHERE id=$1", [
        membership.body.membership.id,
        { kind: "ward", unitIds: [stay.unitId, extraUnit] },
      ]);
      const widened = await store.read(nurse, nurseView);
      assert.notEqual(widened.accessContext, expired.accessContext);
      assert.equal(widened.revision, expired.revision);
    } finally {
      await pool.end();
    }
  },
);

test(
  "real PostgreSQL: roles come from memberships, every reply is scoped, and access changes are audited",
  { skip: !url },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 4 });
    let at = new Date("2026-10-07T10:00:00Z");
    const store = createWorkspaceStore(pool, { workspaceId: randomUUID(), engine, clock: () => at });
    const [lead, second, nurse, admin, coordinator] = Array.from({ length: 5 }, () => randomUUID());
    const later = new Date("2027-01-01T00:00:00Z");
    try {
      await migrate(pool);
      const leadView = await store.viewer(lead, { bootstrap: true });
      assert.equal(leadView.status, "ok");
      assert.deepEqual(leadView.access, engine.STATEWIDE);
      const secondView = await store.viewer(second, { bootstrap: true });
      assert.deepEqual(await store.viewer(nurse), { status: "none" });
      assert.equal((await store.roleHolders()).includes(nurse), false);

      const full = await store.read(lead, leadView);
      const world = full.payload;
      const stay = world.state.admissions.find((row) => row.patientId !== null && row.leftAt === null);
      const elsewhere = world.state.admissions.find(
        (row) => row.unitId !== stay.unitId && row.patientId !== null && row.patientId !== stay.patientId,
      );
      const ward = { kind: "ward", unitIds: [stay.unitId] };

      // Nobody grants themselves a role, a place must exist, and a grant needs an end date.
      assert.equal(
        (await store.grantAccess(leadView, { actorId: lead, role: "ward", scope: ward, expiresAt: later })).status,
        422,
      );
      assert.equal(
        (
          await store.grantAccess(leadView, {
            actorId: nurse,
            role: "ward",
            scope: { kind: "ward", unitIds: ["nowhere"] },
            expiresAt: later,
          })
        ).status,
        422,
      );
      assert.equal(
        (
          await store.grantAccess(leadView, {
            actorId: nurse,
            role: "ward",
            scope: { kind: "site", siteCode: "X" },
            expiresAt: later,
          })
        ).status,
        400,
      );
      assert.equal(
        (await store.grantAccess(leadView, { actorId: nurse, role: "ward", scope: ward, expiresAt: at })).status,
        400,
      );
      const granted = await store.grantAccess(leadView, {
        actorId: nurse,
        role: "ward",
        scope: ward,
        expiresAt: later,
      });
      assert.equal(granted.status, 200);
      assert.equal(granted.body.membership.approved, true);

      // The nurse's desk is the ward, and everything sent back is that ward's part only.
      const nurseView = await store.viewer(nurse);
      assert.equal(nurseView.status, "ok");
      assert.equal((await store.roleHolders()).includes(nurse), true);
      assert.deepEqual(nurseView.access, { role: "ward", scope: ward });
      const scoped = await store.read(nurse, nurseView);
      assert.ok(engine.validWorld(JSON.parse(JSON.stringify(scoped.payload))));
      assert.ok(scoped.payload.state.patients.length < world.state.patients.length);
      assert.equal(JSON.stringify(scoped.payload).includes(JSON.stringify(elsewhere.id)), false);
      // The HTTP layer refuses the audit to a ward; the store would give it nothing anyway.
      assert.deepEqual(await store.audit(nurseView), []);

      // A command naming another ward's stay is refused before the revision is even looked at,
      // and the refusal is audited under the nurse's own role and place.
      const refused = await store.command(
        nurse,
        randomUUID(),
        999,
        { type: "FLAG_BED_RELEASE", role: "ward", admissionId: elsewhere.id },
        { view: nurseView },
      );
      assert.equal(refused.status, 422);
      assert.equal(refused.body.code, "scope");
      assert.equal(JSON.stringify(refused.body.snapshot.payload).includes(JSON.stringify(elsewhere.id)), false);
      const { rows: nurseAudit } = await pool.query(
        "SELECT actor_role, actor_scope, outcome FROM ward_flow.audit WHERE actor_id=$1",
        [nurse],
      );
      assert.deepEqual(nurseAudit, [{ actor_role: "ward", actor_scope: ward, outcome: "denied" }]);

      // Break glass: one patient, for a set time, recorded and audited; a pattern after the set
      // number in a shift. The statewide coordinator never needs it.
      assert.equal((await store.breakGlass(leadView, elsewhere.patientId, "handover")).status, 422);
      assert.equal((await store.breakGlass(nurseView, elsewhere.patientId, "because")).status, 400);
      assert.equal((await store.breakGlass(nurseView, stay.patientId, "handover")).status, 422);
      const opened = await store.breakGlass(nurseView, elsewhere.patientId, "bed-search");
      assert.equal(opened.status, 200);
      assert.equal(opened.body.pattern, false);
      assert.ok(opened.body.snapshot.payload.state.patients.some((row) => row.id === elsewhere.patientId));
      const withGrant = await store.viewer(nurse);
      assert.deepEqual(
        withGrant.grants.map((grant) => grant.patientId),
        [elsewhere.patientId],
      );
      // While a record is open (or has just closed) the poll sends the whole scoped workspace.
      assert.equal((await store.poll(nurse, scoped.revision, withGrant)).notModified, false);
      const others = world.state.patients
        .filter((row) => !scoped.payload.state.patients.some((own) => own.id === row.id))
        .map((row) => row.id)
        .filter((id) => id !== elsewhere.patientId);
      let pattern = false;
      for (const id of others.slice(0, engine.BREAK_GLASS_PER_SHIFT))
        pattern = (await store.breakGlass(nurseView, id, "other")).body.pattern;
      assert.equal(pattern, true);
      at = new Date(at.getTime() + (engine.BREAK_GLASS_MINUTES + 2) * 60_000);
      const closed = await store.viewer(nurse);
      assert.deepEqual(closed.grants, []);
      assert.equal(closed.recentGrant, false);

      // Coordinator and access admin grants work immediately, including existing rows whose
      // approval fields are null. No approval record is manufactured (D-66).
      const pending = await store.grantAccess(leadView, {
        actorId: admin,
        role: "admin",
        scope: { kind: "statewide" },
        expiresAt: later,
      });
      assert.equal(pending.body.membership.approved, true);
      assert.equal(pending.body.membership.approvedBy, null);
      assert.equal((await store.viewer(admin)).access.role, "admin");
      assert.deepEqual(
        (
          await pool.query("SELECT approved_by, approved_at FROM ward_flow.memberships WHERE id=$1", [
            pending.body.membership.id,
          ])
        ).rows,
        [{ approved_by: null, approved_at: null }],
      );
      assert.equal((await store.roleHolders()).includes(admin), true);
      assert.equal((await store.approveAccess(leadView, pending.body.membership.id)).status, 422);
      assert.equal((await store.approveAccess(nurseView, pending.body.membership.id)).status, 403);
      assert.equal((await store.approveAccess(secondView, pending.body.membership.id)).status, 422);
      const adminView = await store.viewer(admin);
      assert.equal(adminView.access.role, "admin");
      const coordinatorGrant = await store.grantAccess(leadView, {
        actorId: coordinator,
        role: "coordinator",
        scope: { kind: "statewide" },
        expiresAt: later,
      });
      assert.equal(coordinatorGrant.body.membership.approved, true);
      assert.equal(coordinatorGrant.body.membership.approvedBy, null);
      assert.equal((await store.approveAccess(adminView, coordinatorGrant.body.membership.id)).status, 422);
      assert.equal((await store.viewer(coordinator)).access.role, "coordinator");

      // The access admin reads role changes only.
      const adminAudit = await store.audit(adminView);
      assert.ok(adminAudit.length > 0);
      assert.ok(adminAudit.every((row) => row.action.startsWith("ACCESS_")));
      // Which patient was opened, and why, is the statewide coordinator's to read.
      assert.ok((await store.audit()).some((row) => row.action === "BREAK_GLASS" && row.changes.pattern === true));
      assert.equal((await store.listAccess(adminView)).body.memberships.length, 3);
      assert.equal((await store.listAccess(nurseView)).status, 403);

      // Two roles: the account says which one it works as.
      await store.grantAccess(leadView, {
        actorId: nurse,
        role: "community",
        scope: { kind: "team", teamName: "Synthetic team" },
        expiresAt: later,
      });
      const choose = await store.viewer(nurse);
      assert.equal(choose.status, "choose");
      assert.equal(choose.choices.length, 2);
      assert.equal((await store.viewer(nurse, { workingAs: nurseView.membershipId })).access.role, "ward");
      assert.deepEqual(await store.viewer(nurse, { workingAs: "bootstrap" }), { status: "none" });

      // A removed role stops at the next request, and the audit still names it.
      assert.equal((await store.revokeAccess(adminView, nurseView.membershipId)).status, 200);
      assert.equal((await store.viewer(nurse)).access.role, "community");
      // A change that looked up its role just before the revoke is stopped inside the lock.
      await assert.rejects(
        store.command(
          nurse,
          randomUUID(),
          999,
          { type: "FLAG_BED_RELEASE", role: "ward", admissionId: elsewhere.id },
          { view: nurseView },
        ),
        /role-ended/,
      );
      assert.equal((await store.revokeAccess(adminView, nurseView.membershipId)).status, 404);
      // Audit rows are never removed, so 008 cannot be rolled back once a role has acted (012,
      // 011, 010 and 009, which keep every audit row, go first).
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          await readFile(new URL("./infra/rollback-012-foreign-key-indexes.sql", import.meta.url), "utf8"),
        );
        await client.query(
          await readFile(new URL("./infra/rollback-011-record-access-and-sign-out.sql", import.meta.url), "utf8"),
        );
        await client.query(
          await readFile(new URL("./infra/rollback-010-workspace-records.sql", import.meta.url), "utf8"),
        );
        await client.query(
          await readFile(new URL("./infra/rollback-009-access-cover-requests.sql", import.meta.url), "utf8"),
        );
        await assert.rejects(
          client.query(await readFile(new URL("./infra/rollback-008-role-access.sql", import.meta.url), "utf8")),
          /cannot be removed/,
        );
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
    } finally {
      await pool.end();
    }
  },
);

test("a ward desk may send the events its screen sends under another role, and nothing else borrowed", async () => {
  const engine = await import("./dist/engine.mjs");
  const at = new Date("2026-10-07T10:00:00Z");
  const world = engine.seedWorld(at);
  const ward = engine.parseAccess("ward", { kind: "ward", unitIds: [world.state.units[0].id] });
  const notYours = "This change is not part of your role.";
  const refusal = (event) => engine.commandRefusal(world, ward, event, at);
  // A ward raises referrals in its own name only, from Raise referral and from its New referral
  // sheet (Josh, 15 Oct 2026). The sheet still adds a patient as ED, through its CROSS_ROLE_ALLOWED
  // pair.
  assert.notEqual(refusal({ type: "RECEIVE_REFERRAL", role: "ward" }), notYours);
  assert.equal(refusal({ type: "RECEIVE_REFERRAL", role: "community" }), notYours);
  assert.equal(refusal({ type: "RECEIVE_REFERRAL", role: "ed" }), notYours);
  assert.notEqual(refusal({ type: "ADD_PATIENT", role: "ed" }), notYours);
  // A borrowed role the event does not take, the coordinator's role, or an event with no pair, is
  // still refused.
  assert.equal(refusal({ type: "RECEIVE_REFERRAL", role: "officer" }), notYours);
  assert.equal(refusal({ type: "RECEIVE_REFERRAL", role: "coordinator" }), notYours);
  assert.equal(refusal({ type: "ADD_PATIENT", role: "coordinator" }), notYours);
  assert.equal(
    refusal({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: world.state.units[0].id }),
    notYours,
  );
});

test(
  "real PostgreSQL: cover, requests for access, alerts by role and the not used switch-off (migration 9)",
  { skip: !url },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 4 });
    const start = Date.parse("2026-10-07T10:00:00Z");
    let at = new Date(start);
    const sent = [];
    const [lead, second, nurseA, nurseB, asker, declined, deskCoordinator, placeCoordinator] = Array.from(
      { length: 8 },
      () => randomUUID(),
    );
    const workspaceId = randomUUID();
    const store = createWorkspaceStore(pool, {
      demoEvents: true,
      workspaceId,
      engine,
      clock: () => at,
      deliveryWaitMs: 10_000,
      push: {
        send: async (row) => {
          sent.push(row.endpoint.split("/").pop());
          return { outcome: "sent" };
        },
        payload: pushPayload,
        coordinatorIds: [lead, second],
        maxPerAccount: 2,
      },
    });
    const device = (name) => ({
      endpoint: `https://fcm.googleapis.com/fcm/send/${name}`,
      p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 3)]).toString("base64url"),
      auth: Buffer.alloc(16, 4).toString("base64url"),
    });
    const later = new Date("2027-06-01T00:00:00Z");
    try {
      await migrate(pool);
      const leadView = await store.viewer(lead, { bootstrap: true });
      const secondView = await store.viewer(second, { bootstrap: true });
      const before = (await store.read(lead, leadView)).payload;
      const [unitA, unitB] = before.state.units.map((unit) => unit.id);
      const wardA = { kind: "ward", unitIds: [unitA] };
      const wardB = { kind: "ward", unitIds: [unitB] };
      const grant = async (actorId, role, scope) =>
        (await store.grantAccess(leadView, { actorId, role, scope, expiresAt: later })).body.membership;
      const roleA = await grant(nurseA, "ward", wardA);
      await grant(nurseB, "ward", wardB);
      const aView = await store.viewer(nurseA);
      // The viewer notes when a role was last used.
      const used = await pool.query("SELECT last_used_at FROM ward_flow.memberships WHERE id=$1", [roleA.id]);
      assert.equal(new Date(used.rows[0].last_used_at).getTime(), start);
      // Read again within the hour, the time is not written again.
      at = new Date(start + 30 * 60_000);
      await store.viewer(nurseA);
      const again = await pool.query("SELECT last_used_at FROM ward_flow.memberships WHERE id=$1", [roleA.id]);
      assert.equal(new Date(again.rows[0].last_used_at).getTime(), start);
      at = new Date(start);

      // Cover: a nurse in charge gives a colleague cover of their own ward, for one shift at most.
      // Longer than one shift (the synthetic cover length is 12 hours).
      const tooLong = 13 * 60;
      assert.equal((await store.giveCover(aView, { actorId: nurseB, scope: wardA, minutes: tooLong })).status, 422);
      assert.equal((await store.giveCover(aView, { actorId: nurseB, scope: wardB, minutes: 60 })).status, 422);
      assert.equal((await store.giveCover(aView, { actorId: nurseA, scope: wardA, minutes: 60 })).status, 422);
      const given = await store.giveCover(aView, { actorId: nurseB, scope: wardA, minutes: 480 });
      assert.equal(given.status, 200);
      assert.equal(given.body.membership.kind, "cover");
      assert.equal(given.body.membership.minutes.expires, 480);
      // The covered ward joins the colleague's own, and they cannot pass it on.
      const bView = await store.viewer(nurseB);
      assert.deepEqual(bView.access, { role: "ward", scope: { kind: "ward", unitIds: [unitB, unitA] } });
      assert.deepEqual(bView.ownAccess, { role: "ward", scope: wardB });
      assert.equal((await store.giveCover(bView, { actorId: asker, scope: wardA, minutes: 60 })).status, 422);
      assert.equal((await store.listCovers(aView)).body.covers.length, 1);
      assert.equal((await store.listCovers(bView)).body.covers.length, 1);
      // Only the giver (or an access admin) ends it, and then the colleague's desk is their own again.
      assert.equal((await store.revokeAccess(bView, given.body.membership.id)).status, 403);
      assert.equal((await store.revokeAccess(aView, given.body.membership.id)).status, 200);
      assert.deepEqual((await store.viewer(nurseB)).access, { role: "ward", scope: wardB });
      // Held with no ward of their own, cover is the whole desk, and it is never given on.
      const relief = randomUUID();
      const reliefCover = await store.giveCover(aView, { actorId: relief, scope: wardA, minutes: 60 });
      assert.equal(reliefCover.status, 200);
      const reliefView = await store.viewer(relief);
      assert.deepEqual(reliefView.access, { role: "ward", scope: wardA });
      assert.equal(reliefView.ownAccess, null);
      const passedOn = await store.giveCover(reliefView, { actorId: nurseB, scope: wardA, minutes: 60 });
      assert.equal(passedOn.status, 403);
      assert.match(passedOn.body.error, /cannot be passed on/);
      // A coordinator for the ward's own service sees that cover and may end it, though not its giver.
      const service = ["North Metro", "South Metro", "East Metro", "WACHS", "CAHS", "Private"].find((name) =>
        engine.scopeWithin(before, wardA, { kind: "service", service: name }),
      );
      const placeRole = await grant(placeCoordinator, "coordinator", { kind: "service", service });
      assert.equal((await store.approveAccess(secondView, placeRole.id)).status, 422);
      assert.equal((await store.viewer(placeCoordinator)).access.role, "coordinator");
      const placeView = await store.viewer(placeCoordinator);
      assert.ok((await store.listCovers(placeView)).body.covers.some((c) => c.id === reliefCover.body.membership.id));
      assert.equal((await store.revokeAccess(placeView, roleA.id)).status, 403);
      assert.equal((await store.revokeAccess(placeView, reliefCover.body.membership.id)).status, 200);
      assert.equal((await store.revokeAccess(leadView, placeRole.id)).status, 200);

      // A person with no role asks once; a request is not a role.
      assert.deepEqual((await store.ownRequest(asker)).body, { request: null });
      assert.equal(
        (await store.requestAccess(asker, { role: "ward", scope: { kind: "ward", unitIds: ["x"] } })).status,
        422,
      );
      const asked = await store.requestAccess(asker, { role: "ward", scope: wardA });
      assert.equal(asked.status, 200);
      assert.equal((await store.requestAccess(asker, { role: "ward", scope: wardB })).status, 422);
      assert.equal((await store.roleHolders()).includes(asker), false);
      assert.deepEqual(await store.viewer(asker), { status: "none" });
      const listed = await store.listAccess(leadView);
      assert.deepEqual(
        listed.body.requests.map((request) => request.actorId),
        [asker],
      );
      // Answering needs an access admin; approving grants the role asked for.
      assert.equal((await store.decideRequest(aView, asked.body.request.id, "approved", later)).status, 403);
      const approved = await store.decideRequest(leadView, asked.body.request.id, "approved", later);
      assert.equal(approved.status, 200);
      assert.deepEqual((await store.viewer(asker)).access, { role: "ward", scope: wardA });
      assert.equal((await store.decideRequest(leadView, asked.body.request.id, "declined", later)).status, 404);
      const other = await store.requestAccess(declined, { role: "ward", scope: wardB });
      assert.equal((await store.decideRequest(leadView, other.body.request.id, "declined", later)).status, 200);
      assert.deepEqual(await store.viewer(declined), { status: "none" });
      assert.equal((await store.ownRequest(declined)).body.request, null);
      const { rows: answers } = await pool.query(
        "SELECT action FROM ward_flow.audit WHERE workspace_id=$1 AND action IN ('ACCESS_COVER','ACCESS_DECLINE') ORDER BY sequence",
        [workspaceId],
      );
      assert.deepEqual(
        answers.map((row) => row.action),
        ["ACCESS_COVER", "ACCESS_COVER", "ACCESS_DECLINE"],
      );

      // Alerts by role: a coordinator by membership hears the whole network, a nurse in charge
      // only the new act-now rows inside their own ward.
      const coordinatorRole = await grant(deskCoordinator, "coordinator", { kind: "statewide" });
      assert.equal((await store.approveAccess(secondView, coordinatorRole.id)).status, 422);
      const coordinatorView = await store.viewer(deskCoordinator);
      assert.equal(store.pushByRole(coordinatorView), true);
      assert.equal(store.pushByRole(aView), true);
      assert.equal(store.pushByRole({ ...aView, access: { role: "executive", scope: { kind: "statewide" } } }), false);
      assert.equal(await store.subscribe(deskCoordinator, device("m1"), coordinatorRole.id), "subscribed");
      assert.equal(await store.subscribe(nurseA, device("n1"), roleA.id), "subscribed");
      const redBefore = new Set(engine.actNowAlerts(before, at).map((alert) => alert.id));
      const jump = { type: "ADVANCE_CLOCK", role: "demo", minutes: 30 };
      assert.equal((await store.command(lead, randomUUID(), 1, jump)).status, 200);
      const after = (await store.read(lead, leadView)).payload;
      const freshAll = engine.actNowAlerts(after, at).some((alert) => !redBefore.has(alert.id));
      const freshWard = engine
        .scopedActNowAlerts(after, { role: "ward", scope: wardA }, at)
        .some((alert) => !redBefore.has(alert.id));
      assert.equal(sent.includes("m1"), freshAll);
      assert.equal(sent.includes("n1"), freshWard);
      assert.ok(freshAll, "the jump raises at least one new red row");
      // The phone alert setting is per desk: switched to another role, this device reads off.
      assert.equal(await store.pushStatus(nurseA, device("n1").endpoint, roleA.id), true);
      assert.equal(await store.pushStatus(nurseA, device("n1").endpoint, null), false);

      // A queued alert is checked against the desk's place and use again when it is sent.
      const wardOf = (unit) => ({ kind: "ward", unitIds: [unit.id] });
      const redIn = (unit) => engine.scopedActNowAlerts(after, { role: "ward", scope: wardOf(unit) }, at);
      const redWard = after.state.units.find((unit) => redIn(unit).length > 0);
      assert.ok(redWard, "some ward has a red row to queue");
      const wardItem = redIn(redWard)[0].id;
      const elsewhere = after.state.units.find(
        (unit) => unit.id !== redWard.id && !redIn(unit).some((alert) => alert.id === wardItem),
      );
      assert.ok(elsewhere);
      await pool.query("UPDATE ward_flow.memberships SET scope=$2 WHERE id=$1", [
        roleA.id,
        JSON.stringify(wardOf(redWard)),
      ]);
      const { rows: n1 } = await pool.query("SELECT id FROM ward_flow.push_subscriptions WHERE endpoint=$1", [
        device("n1").endpoint,
      ]);
      const queue = () =>
        pool.query(
          "INSERT INTO ward_flow.push_deliveries(subscription_id, item_id) VALUES ($1, $2) ON CONFLICT (subscription_id, item_id) DO UPDATE SET status='pending', attempts=0, last_attempt_at=NULL",
          [n1[0].id, wardItem],
        );
      const pending = async () =>
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM ward_flow.push_deliveries WHERE subscription_id=$1 AND status='pending'",
            [n1[0].id],
          )
        ).rows[0].count;
      await queue();
      sent.length = 0;
      await store.sweepPush();
      assert.ok(sent.includes("n1"), "in place and in use, it is sent");
      // Out of the desk's place now: dropped for this device, never sent.
      await pool.query("UPDATE ward_flow.memberships SET scope=$2 WHERE id=$1", [
        roleA.id,
        JSON.stringify(wardOf(elsewhere)),
      ]);
      await queue();
      sent.length = 0;
      await store.sweepPush();
      assert.equal(sent.includes("n1"), false);
      assert.equal(await pending(), 0);
      // A role not used for the set time is no longer heard from, as the viewer switches it off.
      const stale = new Date(start - (engine.ACCESS_UNUSED_MINUTES + 1) * 60_000);
      await pool.query("UPDATE ward_flow.memberships SET scope=$2, last_used_at=$3, granted_at=$3 WHERE id=$1", [
        roleA.id,
        JSON.stringify(wardOf(redWard)),
        stale,
      ]);
      await queue();
      sent.length = 0;
      await store.sweepPush();
      assert.equal(sent.includes("n1"), false);
      assert.equal(await pending(), 1, "left pending, not sent");

      // The admin's list is read in pages, with no row shown twice and at most 500 shown.
      await pool.query(
        "INSERT INTO ward_flow.memberships(id, workspace_id, actor_id, role, scope, granted_by, granted_at, expires_at) SELECT gen_random_uuid(), $1, gen_random_uuid(), 'ward', $2, $3, $4, $5 FROM generate_series(1, 600)",
        [workspaceId, JSON.stringify(wardB), lead, at, later],
      );
      const paged = (await store.listAccess(leadView)).body.memberships;
      assert.equal(paged.length, 500);
      assert.equal(new Set(paged.map((row) => row.id)).size, 500);
      await pool.query(
        "DELETE FROM ward_flow.memberships WHERE workspace_id=$1 AND granted_by=$2 AND role='ward' AND scope=$3 AND actor_id <> ALL($4::uuid[])",
        [workspaceId, lead, JSON.stringify(wardB), [nurseA, nurseB, asker, declined, relief]],
      );

      // A bootstrap coordinator who also holds a role picks which to work as, like anyone else.
      const extra = await grant(second, "ward", wardB);
      const picking = await store.viewer(second, { bootstrap: true });
      assert.equal(picking.status, "choose");
      assert.deepEqual(
        picking.choices.map((choice) => choice.workingAs),
        ["bootstrap", extra.id],
      );
      assert.deepEqual(
        (await store.viewer(second, { bootstrap: true, workingAs: "bootstrap" })).access,
        engine.STATEWIDE,
      );
      assert.equal((await store.revokeAccess(leadView, extra.id)).status, 200);

      // A role not used for the set time stops working by itself; cover is too short to.
      at = new Date(start + (engine.ACCESS_UNUSED_MINUTES + 1) * 60_000);
      assert.deepEqual(await store.viewer(nurseB), { status: "none" });
    } finally {
      await pool.end();
    }
  },
);

test(
  "real PostgreSQL: two people signed in save at once; different records both keep, the same record conflicts, reload and retry",
  { skip: !url },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const workspaceId = randomUUID();
    const [actor, colleague, outsider] = [randomUUID(), randomUUID(), randomUUID()];
    const at = new Date("2026-10-07T10:00:00Z");
    const pools = [new Pool({ connectionString: url, max: 2 }), new Pool({ connectionString: url, max: 2 })];
    const servers = [];
    const logs = [];
    const config = {
      coordinatorIds: [actor, colleague],
      origin: null,
      host: "127.0.0.1",
      port: 0,
      supabase: {
        projectRef: APPROVED_SUPABASE_PROJECT,
        url: APPROVED_SUPABASE_URL,
        publishableKey: "synthetic-offline-only",
      },
    };
    const key = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = (sub) => {
      const data = `${part({ alg: "ES256", kid: "local-integration", typ: "JWT" })}.${part({
        sub,
        iss: `${APPROVED_SUPABASE_URL}/auth/v1`,
        aud: "authenticated",
        role: "authenticated",
        iat: at.getTime() / 1000,
        exp: at.getTime() / 1000 + 3600,
        // The session limit reads the sign-in time against the server's own clock.
        amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }],
        session_id: randomUUID(),
      })}`;
      return `Bearer ${data}.${sign("sha256", Buffer.from(data), { key: key.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
    };
    // Only the public-key response is supplied offline. Signature/claims authentication,
    // HTTP parsing/role selection, SQL transactions, receipts and engine are the real code.
    const authenticate = createSupabaseAuthenticator(config, {
      now: () => at.getTime(),
      fetch: async (endpoint) => {
        assert.equal(endpoint, `${APPROVED_SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
        return Response.json({
          keys: [{ ...key.publicKey.export({ format: "jwk" }), kid: "local-integration", alg: "ES256", use: "sig" }],
        });
      },
    });
    const start = async (pool) => {
      const sharedStore = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
      const server = listen(
        createHandler({ config, sharedStore, authenticate, log: (entry) => logs.push(entry) }),
        config,
      );
      servers.push(server);
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address === "object", "owned HTTP server must bind a TCP address");
      return `http://127.0.0.1:${address.port}/v1/workspace`;
    };
    const request = (endpoint, auth, body) =>
      fetch(endpoint, {
        method: body ? "POST" : "GET",
        headers: { authorization: auth, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    try {
      await migrate(pools[0]);
      const first = await start(pools[0]);
      const credential = token(actor);
      const parts = credential.split(".");
      const forged = `${parts[0]}.${parts[1]}.${Buffer.alloc(64).toString("base64url")}`;
      for (const bad of ["", forged]) assert.equal((await request(first, bad)).status, 401);
      assert.equal((await request(first, token(outsider))).status, 403);
      assert.equal(
        (await pools[0].query("SELECT count(*)::int AS count FROM ward_flow.workspaces WHERE id=$1", [workspaceId]))
          .rows[0].count,
        0,
      );

      const initialResponse = await request(first, credential);
      assert.equal(initialResponse.status, 200);
      const { snapshot: initial } = await initialResponse.json();
      assert.equal(initial.revision, 1);
      const unitId = initial.payload.state.units[0].id;
      const body = {
        classification: "synthetic",
        commandId: randomUUID(),
        expectedRevision: initial.revision,
        actorId: outsider,
        event: { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId },
      };
      const savedResponse = await request(`${first}/commands`, credential, body);
      assert.equal(savedResponse.status, 200);
      const saved = await savedResponse.json();
      assert.equal(saved.outcome, "accepted");
      assert.equal(saved.snapshot.revision, 2);
      const recorded = saved.snapshot.payload.state.refreshRequests.at(-1);
      assert.equal(recorded.unitId, unitId);
      assert.equal(recorded.byRole, "coordinator");

      // Opening a record is logged once a minute per account, record and screen, only for a
      // record this desk can see, and at most 60 a minute per account; only the statewide
      // coordinator reads the log. A sign-out ends that sign-in at once, not when its token
      // expires, and another sign-in of the same account carries on.
      const [patientId, otherPatientId] = initial.payload.state.patients.map((patient) => patient.id);
      const opened = await request(`${first}/record-access`, credential, { patientId, surface: "patient" });
      assert.equal(opened.status, 200);
      assert.deepEqual(await opened.json(), { logged: true });
      const repeated = await request(`${first}/record-access`, credential, { patientId, surface: "patient" });
      assert.deepEqual(await repeated.json(), { logged: false });
      assert.equal(
        (await request(`${first}/record-access`, credential, { patientId: "not a record id", surface: "patient" }))
          .status,
        400,
      );
      assert.equal(
        (await request(`${first}/record-access`, credential, { patientId: "PT-SYN-NOT-HERE", surface: "patient" }))
          .status,
        404,
      );
      // An account that has already logged its minute's worth logs nothing more until it passes.
      await pools[0].query(
        "INSERT INTO ward_flow.record_access(workspace_id, actor_id, actor_role, actor_scope, patient_id, surface, viewed_at) SELECT workspace_id, actor_id, actor_role, actor_scope, 'PT-SYN-' || n, surface, viewed_at FROM ward_flow.record_access, generate_series(1, 59) AS n WHERE actor_id = $1",
        [actor],
      );
      const capped = await request(`${first}/record-access`, credential, {
        patientId: otherPatientId,
        surface: "patient",
      });
      assert.deepEqual(await capped.json(), { logged: false });
      await pools[0].query("ALTER TABLE ward_flow.record_access DISABLE TRIGGER protect_record_access");
      await pools[0].query("DELETE FROM ward_flow.record_access WHERE patient_id LIKE 'PT-SYN-%'");
      await pools[0].query("ALTER TABLE ward_flow.record_access ENABLE TRIGGER protect_record_access");
      const views = await (await request(`${first}/record-access?patient=${patientId}`, credential)).json();
      assert.equal(views.views.length, 1);
      assert.equal(views.views[0].actor_role, "coordinator");
      assert.equal(views.views[0].surface, "patient");
      const leaving = token(actor);
      assert.equal((await request(first, leaving)).status, 200);
      const signedOut = await request(`${first}/sign-out`, leaving, {});
      assert.deepEqual(await signedOut.json(), { signedOut: true });
      const after = await request(first, leaving);
      assert.equal(after.status, 401);
      assert.equal((await after.json()).code, "signed-out");
      assert.equal((await request(first, credential)).status, 200);

      // Separate HTTP listener, store instance, connection pool and authenticated account.
      const second = await start(pools[1]);
      const reloadedResponse = await request(second, token(colleague));
      assert.equal(reloadedResponse.status, 200);
      const { snapshot: reloaded } = await reloadedResponse.json();
      assert.equal(reloaded.revision, 2);
      assert.deepEqual(reloaded.payload, saved.snapshot.payload);
      // The colleague saves against the revision they loaded before the first save. It touches no
      // record the first save changed, so it is kept too: two requests, nothing overwritten.
      const alongsideResponse = await request(`${second}/commands`, token(colleague), {
        ...body,
        commandId: randomUUID(),
      });
      assert.equal(alongsideResponse.status, 200);
      const alongside = await alongsideResponse.json();
      assert.equal(alongside.snapshot.revision, 3);
      assert.deepEqual(
        alongside.snapshot.payload.state.refreshRequests.slice(-2).map((row) => row.unitId),
        [unitId, unitId],
      );

      // Two people change two different movements at the same moment, both from revision 3: both save.
      const urgency = (movementId, value) => ({
        classification: "synthetic",
        commandId: randomUUID(),
        expectedRevision: 3,
        event: {
          type: "CHANGE_URGENCY",
          role: "coordinator",
          now: 600,
          movementId,
          urgency: value,
          reason: "reassessed",
        },
      });
      const [one, two] = await Promise.all([
        request(`${first}/commands`, credential, urgency("WF-001", 2)),
        request(`${second}/commands`, token(colleague), urgency("WF-002", 1)),
      ]);
      assert.deepEqual([one.status, two.status], [200, 200]);
      const both = (await (await request(second, token(colleague))).json()).snapshot;
      assert.equal(both.revision, 5);
      const urgencyOf = (snapshot, id) => snapshot.payload.state.movements.find((row) => row.id === id).urgency;
      assert.deepEqual([urgencyOf(both, "WF-001"), urgencyOf(both, "WF-002")], [2, 1]);

      // Both change the same movement at the same moment, from revision 5: exactly one is kept, and
      // the other is told someone else changed it first, with the board to review.
      const raced = await Promise.all([
        request(`${first}/commands`, credential, { ...urgency("WF-003", 2), expectedRevision: 5 }),
        request(`${second}/commands`, token(colleague), { ...urgency("WF-003", 3), expectedRevision: 5 }),
      ]);
      assert.deepEqual(raced.map((response) => response.status).sort(), [200, 409]);
      const [won, lost] = raced[0].status === 200 ? raced : [raced[1], raced[0]];
      const winner = await won.json();
      const loser = await lost.json();
      assert.equal(loser.outcome, "stale");
      assert.match(loser.error, /Someone else changed this record first/);
      assert.equal(loser.snapshot.revision, 6);
      assert.equal(urgencyOf(loser.snapshot, "WF-003"), urgencyOf(winner.snapshot, "WF-003"));
      // The person told about the clash reloads and saves again; this time it is kept.
      const reloadedRace = (
        await (
          await request(lost === raced[0] ? first : second, lost === raced[0] ? credential : token(colleague))
        ).json()
      ).snapshot;
      assert.equal(reloadedRace.revision, 6);
      const again = await request(
        lost === raced[0] ? `${first}/commands` : `${second}/commands`,
        lost === raced[0] ? credential : token(colleague),
        { ...urgency("WF-003", 1), expectedRevision: 6 },
      );
      assert.equal(again.status, 200);
      assert.equal(urgencyOf((await again.json()).snapshot, "WF-003"), 1);

      const retryResponse = await request(`${first}/commands`, credential, body);
      assert.equal(retryResponse.status, 200);
      const retry = await retryResponse.json();
      assert.equal(retry.replayed, true);
      assert.equal(retry.snapshot.revision, 7);
      assert.equal(
        retry.snapshot.payload.state.refreshRequests.length,
        alongside.snapshot.payload.state.refreshRequests.length,
      );
      const audit = await pools[1].query(
        "SELECT actor_id, outcome, prior_revision, revision FROM ward_flow.audit WHERE workspace_id=$1 AND action='REQUEST_CAPACITY_REFRESH' ORDER BY sequence",
        [workspaceId],
      );
      assert.deepEqual(audit.rows, [
        { actor_id: actor, outcome: "accepted", prior_revision: "1", revision: "2" },
        { actor_id: colleague, outcome: "accepted", prior_revision: "2", revision: "3" },
      ]);
      const raceAudit = await pools[1].query(
        "SELECT outcome, prior_revision, revision FROM ward_flow.audit WHERE workspace_id=$1 AND action='CHANGE_URGENCY' ORDER BY sequence",
        [workspaceId],
      );
      assert.deepEqual(
        raceAudit.rows.map((row) => row.outcome),
        ["accepted", "accepted", "accepted", "stale", "accepted"],
      );
      assert.doesNotMatch(JSON.stringify(logs), new RegExp(`${actor}|${outsider}|${credential.slice(7)}`));
    } finally {
      await Promise.all(
        servers.map(
          (server) => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
        ),
      );
      await Promise.all(pools.map((pool) => pool.end()));
      // Audit is append-only: leave these UUID-scoped rows to the disposable DB owner.
    }
  },
);

test(
  "real PostgreSQL: shared views follow cover changes and recheck access after the workspace lock",
  { skip: !url },
  async (t) => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 4 });
    try {
      await migrate(pool);
      async function fixture() {
        let now = Date.parse("2026-10-07T10:00:00Z");
        const clock = () => new Date(now);
        const workspaceId = randomUUID();
        const lead = randomUUID();
        const nurse = randomUUID();
        const store = createWorkspaceStore(pool, { workspaceId, engine, clock });
        const leadView = await store.viewer(lead, { bootstrap: true });
        const seed = await store.read(lead, leadView);
        const [unitA, unitB] = seed.payload.state.units.map((unit) => unit.id);
        const base = (
          await store.grantAccess(leadView, {
            actorId: nurse,
            role: "ward",
            scope: { kind: "ward", unitIds: [unitA] },
            expiresAt: new Date("2027-06-01T00:00:00Z"),
          })
        ).body.membership;
        const cover = async () =>
          (
            await store.giveCover(leadView, {
              actorId: nurse,
              scope: { kind: "ward", unitIds: [unitB] },
              minutes: 60,
            })
          ).body.membership;
        const confirm = (snapshot) => {
          const unit = snapshot.payload.state.units.find((unit) => unit.id === unitB);
          return {
            type: "CONFIRM_CAPACITY",
            role: "ward",
            unitId: unitB,
            actingUnitId: unitB,
            value: unit.allocatable.value,
            expectedRevision: unit.allocatable.revision ?? 0,
          };
        };
        return {
          store,
          workspaceId,
          lead,
          leadView,
          nurse,
          base,
          unitA,
          unitB,
          cover,
          confirm,
          clock,
          advance: (minutes) => {
            now += minutes * 60_000;
          },
        };
      }
      await t.test("an ended joined cover cannot authorise an already resolved command", async () => {
        const f = await fixture();
        const cover = await f.cover();
        const view = await f.store.viewer(f.nurse);
        const before = await f.store.read(f.nurse, view);
        assert.ok(view.access.scope.unitIds.includes(f.unitB));
        assert.equal((await f.store.revokeAccess(f.leadView, cover.id)).status, 200);
        const result = await f.store.command(f.nurse, randomUUID(), before.revision, f.confirm(before), { view });
        assert.equal(result.status, 422, "revoked cover must be removed before authorising the pending write");
        assert.equal(result.body.code, "scope");
        assert.equal(result.body.snapshot.revision, before.revision);
        const fresh = await f.store.read(f.nurse, await f.store.viewer(f.nurse));
        assert.deepEqual(result.body.snapshot.payload.state.patients, fresh.payload.state.patients);
        assert.ok(fresh.payload.state.patients.length < before.payload.state.patients.length);
      });
      await t.test("joined cover expiry is checked after waiting for the real workspace row lock", async () => {
        const f = await fixture();
        await f.cover();
        const view = await f.store.viewer(f.nurse);
        const before = await f.store.read(f.nurse, view);
        const blocker = await pool.connect();
        let reachedLock;
        const waiting = new Promise((resolve) => {
          reachedLock = resolve;
        });
        const pendingStore = createWorkspaceStore(
          {
            query: pool.query.bind(pool),
            connect: async () => {
              const client = await pool.connect();
              return {
                query: (sql, parameters) => {
                  const result = client.query(sql, parameters);
                  if (sql.includes("FROM ward_flow.workspaces") && sql.endsWith("FOR UPDATE")) reachedLock();
                  return result;
                },
                release: client.release.bind(client),
              };
            },
          },
          { workspaceId: f.workspaceId, engine, clock: f.clock },
        );
        let pending;
        try {
          await blocker.query("BEGIN");
          await blocker.query("SELECT id FROM ward_flow.workspaces WHERE id=$1 FOR UPDATE", [f.workspaceId]);
          pending = pendingStore.command(f.nurse, randomUUID(), before.revision, f.confirm(before), { view });
          await waiting;
          f.advance(61);
          await blocker.query("COMMIT");
          const result = await pending;
          assert.equal(result.status, 422, "cover ending while the command waits must no longer authorise it");
          assert.equal(result.body.snapshot.revision, before.revision);
          assert.equal(
            result.body.snapshot.now,
            before.now + 61,
            "reply and workflow time must also follow the lock wait",
          );
        } finally {
          await blocker.query("ROLLBACK");
          blocker.release();
          await pending?.catch(() => {});
        }
      });
      await t.test("a role grant expiring during a lock wait is refused without a database failure", async () => {
        const f = await fixture();
        const expiresAt = new Date(f.clock().getTime() + 60_000);
        const blocker = await pool.connect();
        let reachedLock;
        const waiting = new Promise((resolve) => {
          reachedLock = resolve;
        });
        const pendingStore = createWorkspaceStore(
          {
            query: pool.query.bind(pool),
            connect: async () => {
              const client = await pool.connect();
              return {
                query: (sql, parameters) => {
                  const result = client.query(sql, parameters);
                  if (sql.includes("FROM ward_flow.workspaces") && sql.endsWith("FOR UPDATE")) reachedLock();
                  return result;
                },
                release: client.release.bind(client),
              };
            },
          },
          { workspaceId: f.workspaceId, engine, clock: f.clock },
        );
        let pending;
        try {
          await blocker.query("BEGIN");
          await blocker.query("SELECT id FROM ward_flow.workspaces WHERE id=$1 FOR UPDATE", [f.workspaceId]);
          pending = pendingStore
            .grantAccess(f.leadView, {
              actorId: randomUUID(),
              role: "ward",
              scope: { kind: "ward", unitIds: [f.unitA] },
              expiresAt,
            })
            .then(
              (response) => ({ response, error: undefined }),
              (error) => ({ response: undefined, error }),
            );
          await waiting;
          f.advance(2);
          await blocker.query("COMMIT");
          const outcome = await pending;
          assert.equal(outcome.error, undefined, "expiry must be a normal refusal, not an SQL constraint failure");
          assert.equal(outcome.response.status, 400);
          assert.match(outcome.response.body.error, /end date in the future/);
        } finally {
          await blocker.query("ROLLBACK");
          blocker.release();
          await pending;
        }
      });
      await t.test("an expired base role cannot write through a previously resolved view", async () => {
        const f = await fixture();
        const view = await f.store.viewer(f.nurse);
        await pool.query("UPDATE ward_flow.memberships SET expires_at=$2 WHERE id=$1", [
          f.base.id,
          new Date(f.clock().getTime() + 60_000),
        ]);
        f.advance(2);
        const before = await f.store.read(f.lead, f.leadView);
        await assert.rejects(
          f.store.command(
            f.nurse,
            randomUUID(),
            before.revision,
            {
              ...f.confirm(before),
              unitId: f.unitA,
              actingUnitId: f.unitA,
            },
            { view },
          ),
          /role-ended/,
        );
      });
      await t.test("a scoped poll waits for an access change holding the workspace lock, then refuses", async () => {
        const f = await fixture();
        const first = await f.store.read(f.nurse, await f.store.viewer(f.nurse));
        const view = await f.store.viewer(f.nurse);
        const revoker = await pool.connect();
        try {
          await revoker.query("BEGIN");
          await revoker.query("SELECT 1 FROM ward_flow.workspaces WHERE id=$1 FOR UPDATE", [f.workspaceId]);
          await revoker.query("UPDATE ward_flow.memberships SET revoked_at=$2, revoked_by=$3 WHERE id=$1", [
            f.base.id,
            f.clock(),
            f.lead,
          ]);
          const pending = f.store.poll(f.nurse, first.revision, view);
          await new Promise((resolve) => setTimeout(resolve, 100));
          await revoker.query("COMMIT");
          await assert.rejects(pending, /role-ended/);
        } finally {
          await revoker.query("ROLLBACK").catch(() => {});
          revoker.release();
        }
      });
      for (const poll of [false, true]) {
        await t.test(
          `HTTP ${poll ? "poll" : "full read"} replies use the authority refreshed after cover ends`,
          async () => {
            const { createHandler } = await import("./server.mjs");
            const f = await fixture();
            const first = await f.store.read(f.nurse, await f.store.viewer(f.nurse));
            const cover = await f.cover();
            const wider = await f.store.read(f.nurse, await f.store.viewer(f.nurse));
            assert.ok(wider.payload.state.patients.length > first.payload.state.patients.length);
            const handler = createHandler({
              config: { coordinatorIds: [f.lead], origin: "http://localhost", workspaceId: f.workspaceId },
              /** @param {string} _token @param {{ session?: { startedAt?: number } }} [context] */
              authenticate: async (_token, { session } = {}) => {
                if (session) Object.assign(session, { startedAt: Date.now(), sessionId: randomUUID() });
                return f.nurse;
              },
              sharedStore: {
                ...f.store,
                viewer: async (actorId, options) => {
                  const view = await f.store.viewer(actorId, options);
                  // Interleave a real committed revoke after the HTTP layer has resolved the desk.
                  assert.equal((await f.store.revokeAccess(f.leadView, cover.id)).status, 200);
                  return view;
                },
              },
              log: () => {},
            });
            const response = await handler(
              new Request(`http://localhost/v1/workspace${poll ? `?since=${first.revision}` : ""}`, {
                headers: { authorization: "Bearer synthetic-test" },
              }),
            );
            assert.equal(response.status, 200);
            const value = await response.json();
            assert.deepEqual(value.access, { role: "ward", scope: { kind: "ward", unitIds: [f.unitA] } });
            assert.equal(value.workingAs, f.base.id);
            assert.deepEqual(value.snapshot.payload.state.patients, first.payload.state.patients);
            assert.equal(value.snapshot.revision, first.revision);
          },
        );
      }
      await t.test("an unchanged member poll naming its access context reads no workspace records", async () => {
        // Audit F-04. Another connection holds the workspace row and every record exclusively, so
        // any read of the records (or the share lock a full scoped read takes) would wait.
        const f = await fixture();
        const first = await f.store.read(f.nurse, await f.store.viewer(f.nurse));
        assert.match(first.accessContext, /^[a-f0-9]{64}$/);
        const blocker = await pool.connect();
        try {
          await blocker.query("BEGIN");
          await blocker.query("SELECT 1 FROM ward_flow.workspaces WHERE id=$1 FOR UPDATE", [f.workspaceId]);
          await blocker.query("LOCK TABLE ward_flow.workspace_records IN ACCESS EXCLUSIVE MODE");
          const within = (promise) =>
            Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve("waited"), 1000))]);
          const lean = await within(
            f.store.poll(f.nurse, first.revision, await f.store.viewer(f.nurse), first.accessContext),
          );
          assert.notEqual(lean, "waited", "an unchanged member poll must not touch the records");
          assert.equal(lean.notModified, true);
          assert.equal(lean.revision, first.revision);
          assert.equal(lean.now, first.now);
          const full = f.store.poll(f.nurse, first.revision, await f.store.viewer(f.nurse), "0".repeat(64));
          assert.equal(await within(full), "waited", "a different access context reads in full");
          await blocker.query("COMMIT");
          assert.equal((await full).notModified, false);
        } finally {
          await blocker.query("ROLLBACK").catch(() => {});
          blocker.release();
        }
        // Gaining cover changes the context, so the old one no longer earns the cheap answer.
        await f.cover();
        const widened = await f.store.poll(f.nurse, first.revision, await f.store.viewer(f.nurse), first.accessContext);
        assert.equal(widened.notModified, false);
        assert.ok(widened.snapshot.payload.state.patients.length > first.payload.state.patients.length);
      });
      await t.test("same-revision polls send fresh scopes after cover grant, revoke and expiry", async () => {
        const f = await fixture();
        const first = await f.store.read(f.nurse, await f.store.viewer(f.nurse));
        const cover = await f.cover();
        const added = await f.store.poll(f.nurse, first.revision, await f.store.viewer(f.nurse));
        assert.equal(added.notModified, false, "clinical revision alone cannot identify a scoped view");
        assert.equal(added.snapshot.revision, first.revision);
        assert.ok(added.snapshot.payload.state.patients.length > first.payload.state.patients.length);
        await f.store.revokeAccess(f.leadView, cover.id);
        const removed = await f.store.poll(f.nurse, first.revision, await f.store.viewer(f.nurse));
        assert.equal(removed.notModified, false);
        assert.deepEqual(removed.snapshot.payload.state.patients, first.payload.state.patients);
        await f.cover();
        f.advance(61);
        const expired = await f.store.poll(f.nurse, first.revision, await f.store.viewer(f.nurse));
        assert.equal(expired.notModified, false);
        assert.deepEqual(expired.snapshot.payload.state.patients, first.payload.state.patients);
        assert.equal(
          (await f.store.poll(f.lead, first.revision, f.leadView)).notModified,
          true,
          "bootstrap whole-network views keep lean polls",
        );
      });
    } finally {
      await pool.end();
    }
  },
);

/** Audit E-01: a synthetic referral with every contact the audit must leave out. */
const contactReferral = () => ({
  type: "RECEIVE_REFERRAL",
  role: "community",
  ageBand: "Adult",
  homeRegion: "Perth Metropolitan",
  suburb: { kind: "named", name: "Perth" },
  source: "community",
  urgency: 2,
  originSiteCode: "SCGH",
  transportNeeded: false,
  history: "Synthetic patient story",
  intake: {
    catchment: { teamName: "Inner City Clinic", service: "East Metro", confirmed: true },
    reasonForReferral: "Synthetic referral for assessment",
    legalStatus: "Voluntary",
    riskFlags: [],
    medicalClearance: {
      cleared: false,
      expectedAt: "2026-10-07T18:00+08:00",
      contactName: "Demo Doctor",
      contactPhone: "5550 0102",
    },
    triageAndRampCompleted: false,
    additionalDocuments: false,
    charts: [
      { kind: "medication", name: "medication.pdf", mimeType: "application/pdf", sizeBytes: 21 },
      { kind: "observation", name: "observation.pdf", mimeType: "application/pdf", sizeBytes: 21 },
    ],
    referrer: {
      name: "Demo Sender",
      phone: "5550 0101",
      email: "demo@example.test",
      role: "Nurse",
      location: "Synthetic ED",
    },
  },
  destinations: [
    {
      kind: "psychiatric_ward",
      unitId: "scgh-adult-open",
      sex: "Female",
      gender: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      highAcuityNursingNeeded: false,
    },
  ],
});
const CONTACT_STRINGS = ["Demo Sender", "5550 0101", "demo@example.test", "Demo Doctor", "5550 0102"];
/** Each later step on one referral that writes an Undo snapshot. */
const contactReferralSteps = (referralId) => [
  { type: "RECORD_MEDICAL_CLEARANCE", role: "ed", referralId, cleared: true },
  {
    type: "ACCEPT_REFERRAL",
    role: "coordinator",
    referralId,
    destinationKind: "psychiatric_ward",
    unitId: "scgh-adult-open",
  },
  { type: "UNDO_REFERRAL_DECISION", role: "coordinator", referralId },
  {
    type: "DECLINE_REFERRAL",
    role: "coordinator",
    referralId,
    destinationKind: "psychiatric_ward",
    unitId: "scgh-adult-open",
    reason: "no_suitable_bed",
  },
];

test("no undoable referral step copies the referrer's or clearance contact's details into the audit", async () => {
  // Audit E-01: the Undo snapshot of each step held the whole referral row, contacts included.
  const engine = await import("./dist/engine.mjs");
  const at = new Date("2026-10-07T10:00:00Z");
  let applied = engine.applyCommand(engine.seedWorld(at), contactReferral(), at);
  assert.equal(applied.outcome, "accepted");
  let world = applied.world;
  const referralId = world.state.referrals.at(-1).id;
  for (const [index, event] of contactReferralSteps(referralId).entries()) {
    applied = engine.applyCommand(world, event, new Date(at.getTime() + (index + 1) * 60_000));
    assert.equal(applied.outcome, "accepted", `${event.type}: ${applied.reason}`);
    const facts = JSON.stringify(applied.changes.facts);
    assert.ok(!Object.hasOwn(applied.changes.facts, "undoRecords"), event.type);
    for (const secret of CONTACT_STRINGS) assert.ok(!facts.includes(secret), `${event.type} audits ${secret}`);
    assert.ok(
      applied.world.state.undoRecords.some((record) => JSON.stringify(record).includes("demo@example.test")),
      `${event.type} still keeps its Undo snapshot on the board`,
    );
    world = applied.world;
  }
});

test(
  "real PostgreSQL: a shared referral stores no chart file, and its audit copy no contact details",
  { skip: !url },
  async () => {
    // Audit F-01. An older browser may still send the file; the server drops it before saving.
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 4 });
    const actor = "33333333-3333-4333-8333-333333333333";
    const at = new Date("2026-10-07T10:00:00Z");
    const workspaceId = randomUUID();
    const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
    const file = "JVBERi0xLjQKJSBzeW50aGV0aWMK"; // "%PDF-1.4\n% synthetic\n"
    const contact = { name: "Demo Sender", phone: "5550 0101", email: "demo@example.test" };
    const chart = (kind) => ({ kind, name: `${kind}.pdf`, mimeType: "application/pdf", sizeBytes: 21, base64: file });
    try {
      await migrate(pool);
      await store.ready();
      const seed = await store.read(actor);
      const referral = {
        type: "RECEIVE_REFERRAL",
        role: "community",
        ageBand: "Adult",
        homeRegion: "Perth Metropolitan",
        suburb: { kind: "named", name: "Perth" },
        source: "community",
        urgency: 2,
        originSiteCode: "SCGH",
        transportNeeded: false,
        history: "Synthetic patient story",
        intake: {
          catchment: { teamName: "Inner City Clinic", service: "East Metro", confirmed: true },
          reasonForReferral: "Synthetic referral for assessment",
          legalStatus: "Voluntary",
          riskFlags: [],
          medicalClearance: {
            cleared: false,
            expectedAt: "2026-10-07T18:00+08:00",
            contactName: "Demo Doctor",
            contactPhone: "5550 0102",
          },
          triageAndRampCompleted: false,
          additionalDocuments: false,
          charts: [chart("medication"), chart("observation")],
          referrer: { ...contact, role: "Nurse", location: "Synthetic ED" },
        },
        destinations: [
          {
            kind: "psychiatric_ward",
            unitId: "scgh-adult-open",
            sex: "Female",
            gender: "Female",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
        ],
      };
      const result = await store.command(actor, randomUUID(), seed.revision, referral);
      assert.equal(result.status, 200, JSON.stringify(result.body.error ?? null));
      const created = result.body.snapshot.payload.state.referrals.at(-1);
      assert.deepEqual(
        created.intake.charts.map((row) => [row.kind, row.name, row.sizeBytes, "base64" in row]),
        [
          ["medication", "medication.pdf", 21, false],
          ["observation", "observation.pdf", 21, false],
        ],
      );
      // The workspace keeps the contact details the workflow needs; the audit does not.
      assert.equal(created.intake.referrer.email, contact.email);
      const saved = await pool.query(
        "SELECT string_agg(body::text, '') AS text FROM ward_flow.workspace_records WHERE workspace_id=$1",
        [workspaceId],
      );
      const whole = await pool.query("SELECT payload::text AS text FROM ward_flow.workspaces WHERE id=$1", [
        workspaceId,
      ]);
      for (const text of [saved.rows[0].text ?? "", whole.rows[0].text ?? ""]) assert.ok(!text.includes(file));
      const { rows } = await pool.query(
        "SELECT changes::text AS text FROM ward_flow.audit WHERE workspace_id=$1 AND action='RECEIVE_REFERRAL'",
        [workspaceId],
      );
      assert.equal(rows.length, 1);
      for (const secret of [file, contact.name, contact.phone, contact.email, "Demo Doctor", "5550 0102"])
        assert.ok(!rows[0].text.includes(secret), `the audit copy must not hold ${secret}`);
      assert.ok(rows[0].text.includes("medication.pdf"), "the audit still records which files were named");

      // Audit E-01: nor do the later steps on the same referral, through their Undo snapshots.
      let revision = result.body.snapshot.revision;
      for (const event of contactReferralSteps(created.id)) {
        const step = await store.command(actor, randomUUID(), revision, event);
        assert.equal(step.status, 200, `${event.type}: ${JSON.stringify(step.body.error ?? null)}`);
        revision = step.body.snapshot.revision;
      }
      const steps = await pool.query(
        "SELECT action, changes::text AS text FROM ward_flow.audit WHERE workspace_id=$1 AND action = ANY($2)",
        [workspaceId, contactReferralSteps(created.id).map((event) => event.type)],
      );
      assert.equal(steps.rows.length, 4);
      for (const row of steps.rows)
        for (const secret of [contact.name, contact.phone, contact.email, "Demo Doctor", "5550 0102"])
          assert.ok(!row.text.includes(secret), `the ${row.action} audit copy must not hold ${secret}`);

      // A receipt written before this change was fingerprinted with the file content, so a tab that
      // still sends it can retry that command and get its original answer.
      const legacyWorkspace = randomUUID();
      const legacyStore = createWorkspaceStore(pool, {
        workspaceId: legacyWorkspace,
        engine: { ...engine, storableCommand: (event) => event },
        clock: () => at,
      });
      await legacyStore.ready();
      const legacySeed = await legacyStore.read(actor);
      const commandId = randomUUID();
      assert.equal((await legacyStore.command(actor, commandId, legacySeed.revision, referral)).status, 200);
      const upgraded = createWorkspaceStore(pool, { workspaceId: legacyWorkspace, engine, clock: () => at });
      const retried = await upgraded.command(actor, commandId, legacySeed.revision, referral);
      assert.equal(retried.status, 200, JSON.stringify(retried.body.error ?? null));
      assert.equal(retried.body.replayed, true);
      const changed = await upgraded.command(actor, commandId, legacySeed.revision, {
        ...referral,
        history: "A different synthetic story",
      });
      assert.equal(changed.status, 422);
    } finally {
      await pool.end();
    }
  },
);

test("the synthetic-data guard's refusal names the kind of identifier, never the text", async () => {
  // Audit E-06. The demo's own numbers are in the fictitious 08 5550 range and pass.
  const engine = await import("./dist/engine.mjs");
  const refresh = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: "rph-adult-secure" };
  const reason = engine.privacyRefusal({ ...refresh, note: "Ring 0412 345 678" });
  assert.match(reason, /telephone number/);
  assert.ok(!reason.includes("0412"));
  assert.equal(engine.privacyRefusal({ ...refresh, note: "Ring 08 5550 0142" }), null);
  assert.equal(engine.privacyRefusal({ ...refresh, note: "fine" }), null);
  // A malformed command is still a bad request, not a guard refusal.
  assert.equal(engine.privacyRefusal({ ...refresh, role: "ward", note: "Ring 0412 345 678" }), null);
});

test(
  "real PostgreSQL: a synthetic-data guard refusal is a 422 with its reason, audited without the text",
  { skip: !url },
  async () => {
    // Audit E-06: it was a 400 with no reason, and the demo's own phone number tripped it.
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 4 });
    const actor = "44444444-4444-4444-8444-444444444444";
    const workspaceId = randomUUID();
    const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date("2026-10-07T10:00:00Z") });
    const refresh = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: "rph-adult-secure" };
    try {
      await migrate(pool);
      await store.ready();
      const seed = await store.read(actor);
      const commandId = randomUUID();
      const refused = await store.command(actor, commandId, seed.revision, { ...refresh, note: "Ring 0412 345 678" });
      assert.equal(refused.status, 422);
      assert.equal(refused.body.outcome, "denied");
      assert.match(refused.body.error, /telephone number/);
      const replay = await store.command(actor, commandId, seed.revision, { ...refresh, note: "Ring 0412 345 678" });
      assert.equal(replay.status, 422);
      assert.equal(replay.body.replayed, true);
      const kept = await pool.query(
        "SELECT (SELECT string_agg(a::text, '') FROM ward_flow.audit a WHERE workspace_id=$1) AS audit, (SELECT string_agg(c::text, '') FROM ward_flow.commands c WHERE workspace_id=$1) AS receipts",
        [workspaceId],
      );
      assert.ok(!`${kept.rows[0].audit}${kept.rows[0].receipts}`.includes("345 678"));
      const accepted = await store.command(actor, randomUUID(), seed.revision, {
        ...refresh,
        note: "Ring 08 5550 0142",
      });
      assert.equal(accepted.status, 200, JSON.stringify(accepted.body.error ?? null));
    } finally {
      await pool.end();
    }
  },
);

test("a partly refused Refer to wards is saved and says which ward was held back", async () => {
  // Audit E-05: the suitable ward is referred, the other held back, and the sender is now told.
  const engine = await import("./dist/engine.mjs");
  const at = new Date("2026-10-07T10:00:00Z");
  const world = engine.seedWorld(at);
  const movement = world.state.movements.find((row) => row.id === "WF-009");
  movement.gender = "Male";
  const secure = world.state.units.find((unit) => unit.id === "fsh-adult-secure");
  secure.cohort = world.state.units.find((unit) => unit.cohort !== movement.cohort).cohort;
  const event = {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    movementId: "WF-009",
    unitIds: ["rph-adult-secure", "fsh-adult-secure"],
  };
  const applied = engine.applyCommand(world, event, at);
  assert.equal(applied.outcome, "accepted");
  assert.equal(typeof applied.partly, "string");
  assert.ok(applied.partly.length > 0);
  const referred = applied.world.state.movements.find((row) => row.id === "WF-009").referredUnitIds;
  assert.ok(referred.includes("rph-adult-secure") && !referred.includes("fsh-adult-secure"));
  // An ordinary accepted command carries no such note.
  const refresh = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: "rph-adult-secure" };
  assert.equal(engine.applyCommand(world, refresh, at).partly, null);
  // Every ward held back is named, not just the last.
  world.state.units.find((unit) => unit.id === "brm-adult-secure").cohort = secure.cohort;
  const two = engine.applyCommand(world, { ...event, unitIds: [...event.unitIds, "brm-adult-secure"] }, at);
  assert.equal(two.outcome, "accepted");
  for (const name of [secure.name, world.state.units.find((unit) => unit.id === "brm-adult-secure").name])
    assert.ok(two.partly.includes(name), `names ${name}`);
});
