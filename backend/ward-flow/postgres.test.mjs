import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
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
            message: "unexpected state",
          },
        ]);
      });
      await t.test("a slow push service does not hold the save response", async () => {
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
        const stale = await shared.command(actor, randomUUID(), 1, refresh, { revisionOnly: true });
        assert.equal(stale.status, 409);
        assert.equal(stale.body.snapshot.revision, 2, "a stale command always carries the board");
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
  "real PostgreSQL: row-level security lets only the runtime role through, and 007 then 006 roll back to 5",
  { skip: !url },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const admin = new Pool({ connectionString: url, max: 2 });
    const database = `wardflow_rls_${randomUUID().replaceAll("-", "")}`;
    const target = new URL(url);
    target.pathname = `/${database}`;
    // Each pool acts as one role from the start of every connection, as the real logins do.
    const as = (role) =>
      new Pool({ connectionString: target.href, max: 2, ...(role && { options: `-c role=${role}` }) });
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
      assert.equal(tables.length, 7);
      assert.ok(tables.every((row) => row.relrowsecurity && !row.relforcerowsecurity));

      await runtimeOk(runtime);
      const store = createWorkspaceStore(runtime, { workspaceId: randomUUID(), engine, demoEvents: true });
      await store.ready();
      await store.read(actor);
      assert.equal((await store.command(actor, randomUUID(), 1, refresh)).status, 200);

      // A role with a grant it should never have still sees and writes nothing.
      await owner.query("DROP ROLE IF EXISTS wardflow_rls_probe");
      await owner.query("CREATE ROLE wardflow_rls_probe NOLOGIN");
      await owner.query(
        "GRANT USAGE ON SCHEMA ward_flow TO wardflow_rls_probe; GRANT SELECT, INSERT ON ward_flow.workspaces, ward_flow.audit TO wardflow_rls_probe",
      );
      const probe = as("wardflow_rls_probe");
      pools.push(probe);
      assert.equal((await probe.query("SELECT count(*)::int AS n FROM ward_flow.workspaces")).rows[0].n, 0);
      assert.equal((await probe.query("SELECT count(*)::int AS n FROM ward_flow.audit")).rows[0].n, 0);
      await assert.rejects(
        probe.query("INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES (gen_random_uuid(), 1, '{}')"),
        /row-level security/,
      );
      await probe.end();
      pools.pop();
      await owner.query("REVOKE ALL ON ward_flow.workspaces, ward_flow.audit FROM wardflow_rls_probe");
      await owner.query("REVOKE ALL ON SCHEMA ward_flow FROM wardflow_rls_probe; DROP ROLE wardflow_rls_probe");

      // Each rollback, newest first, takes the database back one step and the same backend keeps
      // working at every step. After 007's, a live label is allowed again, exactly as before.
      const rollBack = async (file) => {
        const client = await owner.connect();
        try {
          await client.query("BEGIN");
          await client.query(await sql(file));
          await client.query("COMMIT");
        } finally {
          client.release();
        }
      };
      let revision = 2;
      for (const [file, version] of [
        ["./infra/rollback-007-prototype-only.sql", 6],
        ["./infra/rollback-006-row-level-security.sql", 5],
      ]) {
        await rollBack(file);
        assert.equal((await owner.query("SELECT max(version) AS v FROM ward_flow.migrations")).rows[0].v, version);
        await verifyPostgresNamespace(owner);
        await runtimeOk(runtime);
        await store.ready();
        assert.equal((await store.command(actor, randomUUID(), revision++, refresh)).status, 200);
      }
      const { rows: check } = await owner.query(
        "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='workspaces_data_mode_check'",
      );
      assert.equal(check[0].def, "CHECK ((data_mode = ANY (ARRAY['prototype'::text, 'live'::text])))");

      // 007 refuses, and the whole run rolls back, while any workspace is labelled live.
      const liveId = randomUUID();
      await owner.query("INSERT INTO ward_flow.workspaces(id,revision,payload,data_mode) VALUES($1,1,'{}','live')", [
        liveId,
      ]);
      await assert.rejects(migrate(owner), /not prototype/);
      assert.equal((await owner.query("SELECT max(version) AS v FROM ward_flow.migrations")).rows[0].v, 5);
      await owner.query("DELETE FROM ward_flow.workspaces WHERE id=$1", [liveId]);

      // Re-applying 6 and 7 works; a policy removed afterwards is refused by both checks.
      await migrate(owner);
      await verifyPostgresNamespace(owner);
      await runtimeOk(runtime);
      await owner.query("DROP POLICY runtime_only ON ward_flow.audit");
      await assert.rejects(runtimeOk(runtime), /unsafe/);
      await assert.rejects(verifyPostgresNamespace(owner), /Unrecognised or unsafe/);
    } finally {
      for (const pool of pools) await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      await admin.end();
    }
  },
);
