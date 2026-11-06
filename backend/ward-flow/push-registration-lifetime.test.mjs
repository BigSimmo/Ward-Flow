// @ts-check
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore, MAX_DELIVERY_ATTEMPTS } from "./postgres.mjs";
import * as engine from "./dist/engine.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Push registration lifetime tests require isolated loopback PostgreSQL");
const start = Date.parse("2026-11-05T16:00:00Z");
const outcomes = [
  { name: "sent", result: { outcome: "sent" }, status: "sent" },
  { name: "expired", result: { outcome: "expired" }, status: null },
  { name: "rejected", result: { outcome: "failed", retry: false, category: "subscription" }, status: "failed" },
  { name: "retry", result: { outcome: "failed", retry: true, category: "service" }, status: "pending" },
];

before(async () => {
  if (!url) return;
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(pool);
  } finally {
    await pool.end();
  }
});

function gate() {
  let release = /** @type {() => void} */ (() => {});
  const promise = new Promise((resolve) => {
    release = () => resolve(undefined);
  });
  return { promise, release };
}

async function within(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Synthetic send did not reach its barrier")), 5000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function fixture() {
  const pool = new Pool({ connectionString: url, max: 4 });
  const actor = randomUUID(),
    colleague = randomUUID(),
    workspaceId = randomUUID(),
    otherWorkspace = randomUUID();
  const subscription = {
    endpoint: `https://synthetic.invalid/push/${randomUUID()}`,
    p256dh: "synthetic-key",
    auth: "synthetic-auth",
  };
  let now = start;
  const logs = [];
  const make = (workspace = workspaceId, send = async () => ({ outcome: "sent" }), adapter = pool) =>
    createWorkspaceStore(adapter, {
      workspaceId: workspace,
      engine,
      clock: () => new Date(now),
      push: {
        coordinatorIds: [actor, colleague],
        maxPerAccount: 10,
        payload: (items) => ({ count: items.length }),
        send,
      },
      log: (entry) => logs.push(entry),
    });
  const store = make();
  const control = createWorkspaceStore(pool, {
    workspaceId,
    engine,
    clock: () => new Date(now),
    demoEvents: true,
    log: (entry) => logs.push(entry),
  });
  const world = (await store.read(actor)).payload;
  const alerts = engine.actNowAlerts(world, new Date(now));
  assert.ok(alerts.length >= 2, "the actual synthetic engine supplies real red alerts");
  await make(otherWorkspace).read(colleague);
  assert.equal(await store.subscribe(actor, subscription), "subscribed");
  async function registration() {
    return (
      await pool.query(
        "SELECT id, workspace_id, actor_id, membership_id, created_at::text AS registration, last_success_at FROM ward_flow.push_subscriptions WHERE endpoint=$1",
        [subscription.endpoint],
      )
    ).rows[0];
  }
  const id = (await registration()).id;
  return {
    pool,
    store,
    make,
    actor,
    colleague,
    workspaceId,
    otherWorkspace,
    subscription,
    world,
    alerts,
    id,
    logs,
    registration,
    async demo(event) {
      const current = await control.read(actor);
      const reply = await control.command(actor, randomUUID(), current.revision, event);
      assert.equal(reply.status, 200);
      return (await control.read(actor)).payload;
    },
    setNow(value) {
      now = value;
    },
    async queue(item = alerts[0].id, attempts = 0) {
      await pool.query("INSERT INTO ward_flow.push_deliveries(subscription_id,item_id,attempts) VALUES($1,$2,$3)", [
        id,
        item,
        attempts,
      ]);
    },
    async delivery(item = alerts[0].id) {
      return (
        await pool.query(
          "SELECT status, attempts, last_attempt_at FROM ward_flow.push_deliveries WHERE subscription_id=$1 AND item_id=$2",
          [id, item],
        )
      ).rows[0];
    },
    finish: () => pool.end(),
  };
}

test("real PostgreSQL: current registration still accepts every provider outcome", { skip: !url }, async (t) => {
  for (const outcome of outcomes)
    await t.test(outcome.name, async () => {
      const f = await fixture();
      try {
        await f.queue();
        await f.make(f.workspaceId, async () => outcome.result).sweepPush();
        const registration = await f.registration(),
          delivery = await f.delivery();
        if (outcome.name === "expired") {
          assert.equal(registration, undefined);
          assert.equal(delivery, undefined);
        } else {
          assert.equal(delivery.status, outcome.status);
          assert.equal(delivery.attempts, 1);
          assert.equal(registration.last_success_at?.getTime() ?? null, outcome.name === "sent" ? start : null);
        }
        assert.equal(
          f.logs.some(({ event }) => event === "ward_backend_push_delivery_unavailable"),
          false,
        );
      } finally {
        await f.finish();
      }
    });
});

test(
  "real PostgreSQL: an old provider outcome cannot change a replacement registration or its same-clock claim",
  { skip: !url, timeout: 30_000 },
  async (t) => {
    for (const replacement of ["same account", "rotated keys", "other account", "other workspace", "other desk"])
      for (const outcome of outcomes)
        await t.test(`${replacement}: ${outcome.name}`, async () => {
          const f = await fixture();
          const entered = gate(),
            finish = gate(),
            nextEntered = gate(),
            nextFinish = gate();
          let oldPass, nextPass;
          try {
            let membership = null;
            if (replacement === "other desk") {
              const lead = await f.store.viewer(f.colleague, { bootstrap: true });
              const granted = await f.store.grantAccess(lead, {
                actorId: f.actor,
                role: "coordinator",
                scope: { kind: "statewide" },
                expiresAt: new Date(start + 3_600_000),
              });
              assert.equal(granted.status, 200);
              membership = granted.body.membership.id;
            }
            await f.queue();
            oldPass = f
              .make(f.workspaceId, async () => {
                entered.release();
                await finish.promise;
                return outcome.result;
              })
              .sweepPush();
            await within(entered.promise);
            const original = await f.registration();
            const workspace = replacement === "other workspace" ? f.otherWorkspace : f.workspaceId;
            const actor = replacement === "other account" || replacement === "other workspace" ? f.colleague : f.actor;
            const subscription =
              replacement === "rotated keys"
                ? { ...f.subscription, p256dh: "new-synthetic-key", auth: "new-synthetic-auth" }
                : f.subscription;
            const next = f.make(workspace, async () => {
              nextEntered.release();
              await nextFinish.promise;
              return { outcome: "sent" };
            });
            // All replacements happen at the identical application clock. PostgreSQL must still
            // distinguish each accepted registration, including repeated replacements in one ms.
            assert.equal(await next.subscribe(actor, subscription, membership), "subscribed");
            assert.equal(await next.subscribe(actor, subscription, membership), "subscribed");
            const current = await f.registration();
            assert.equal(current.id, f.id, "the supported upsert retains its public row identity");
            assert.notEqual(
              current.registration,
              original.registration,
              "accepted replacements have distinct exact registration instants",
            );
            await f.queue(f.alerts[0].id, MAX_DELIVERY_ATTEMPTS - 1);
            nextPass = next.sweepPush();
            await within(nextEntered.promise);
            finish.release();
            await oldPass;
            const retained = await f.registration(),
              delivery = await f.delivery();
            assert.ok(retained, "a stale expired result cannot delete the current registration");
            assert.equal(retained.registration, current.registration);
            assert.equal(retained.last_success_at, null, "an old success cannot credit an undelivered registration");
            assert.equal(delivery.status, "pending", "the newer worker still owns its pending final attempt");
            assert.equal(delivery.attempts, MAX_DELIVERY_ATTEMPTS);
            nextFinish.release();
            await nextPass;
            assert.equal((await f.delivery()).status, "sent", "the actual current result is accepted");
            assert.equal((await f.registration()).last_success_at.getTime(), start);
            assert.equal(
              f.logs.some(({ event }) => event === "ward_backend_push_delivery_unavailable"),
              false,
            );
          } finally {
            finish.release();
            nextFinish.release();
            await Promise.all([oldPass, nextPass]);
            await f.finish();
          }
        });
  },
);

test(
  "real PostgreSQL: an expired old lease cannot remove or credit a newer claim on the same registration",
  { skip: !url },
  async (t) => {
    for (const outcome of outcomes)
      await t.test(outcome.name, async () => {
        const f = await fixture();
        const entered = gate(),
          finish = gate(),
          nextEntered = gate(),
          nextFinish = gate();
        let oldPass, nextPass;
        try {
          await f.queue();
          oldPass = f
            .make(f.workspaceId, async () => {
              entered.release();
              await finish.promise;
              return outcome.result;
            })
            .sweepPush();
          await within(entered.promise);
          f.setNow(start + 60_001);
          nextPass = f
            .make(f.workspaceId, async () => {
              nextEntered.release();
              await nextFinish.promise;
              return { outcome: "sent" };
            })
            .sweepPush();
          await within(nextEntered.promise);
          finish.release();
          await oldPass;
          assert.ok(await f.registration(), "the current registration survives an expired old response");
          assert.equal((await f.registration()).last_success_at, null);
          assert.equal((await f.delivery()).status, "pending");
          assert.equal((await f.delivery()).attempts, 2);
          nextFinish.release();
          await nextPass;
          assert.equal((await f.delivery()).status, "sent");
          assert.equal((await f.registration()).last_success_at.getTime(), start + 60_001);
        } finally {
          finish.release();
          nextFinish.release();
          await Promise.all([oldPass, nextPass]);
          await f.finish();
        }
      });
  },
);

test(
  "real PostgreSQL: unsubscribe while a provider is pending keeps every old result inert",
  { skip: !url },
  async (t) => {
    for (const outcome of outcomes)
      await t.test(outcome.name, async () => {
        const f = await fixture();
        const entered = gate(),
          finish = gate();
        let pass;
        try {
          await f.queue();
          pass = f
            .make(f.workspaceId, async () => {
              entered.release();
              await finish.promise;
              return outcome.result;
            })
            .sweepPush();
          await within(entered.promise);
          await f.store.unsubscribe(f.actor, f.subscription.endpoint);
          finish.release();
          await pass;
          assert.ok(await f.registration(), "an expired stale result must not delete the retained revoked row");
          assert.equal((await f.registration()).last_success_at, null);
          assert.equal(await f.delivery(), undefined);
          assert.equal(await f.store.pushStatus(f.actor, f.subscription.endpoint), false);
        } finally {
          finish.release();
          await pass;
          await f.finish();
        }
      });
  },
);

test("real PostgreSQL: successful independent claims cannot move last success backwards", { skip: !url }, async () => {
  const f = await fixture();
  const entered = gate(),
    finish = gate();
  let pass;
  try {
    await f.queue();
    pass = f
      .make(f.workspaceId, async () => {
        entered.release();
        await finish.promise;
        return { outcome: "sent" };
      })
      .sweepPush();
    await within(entered.promise);
    f.setNow(start + 1000);
    await f.queue(f.alerts[1].id);
    await f.make().sweepPush();
    assert.equal((await f.registration()).last_success_at.getTime(), start + 1000);
    finish.release();
    await pass;
    assert.equal((await f.delivery()).status, "sent");
    assert.equal((await f.registration()).last_success_at.getTime(), start + 1000);
  } finally {
    finish.release();
    await pass;
    await f.finish();
  }
});

test(
  "real PostgreSQL: an acknowledgement owns only its captured items when another item is claimed at the same clock",
  { skip: !url },
  async (t) => {
    for (const outcome of outcomes.filter(({ name }) => name !== "expired"))
      await t.test(outcome.name, async () => {
        const f = await fixture();
        const entered = gate(),
          finish = gate(),
          nextEntered = gate(),
          nextFinish = gate();
        let pass, nextPass;
        try {
          await f.queue();
          pass = f
            .make(f.workspaceId, async () => {
              entered.release();
              await finish.promise;
              return outcome.result;
            })
            .sweepPush();
          await within(entered.promise);
          await f.queue(f.alerts[1].id, MAX_DELIVERY_ATTEMPTS - 1);
          nextPass = f
            .make(f.workspaceId, async () => {
              nextEntered.release();
              await nextFinish.promise;
              return { outcome: "sent" };
            })
            .sweepPush();
          await within(nextEntered.promise);
          finish.release();
          await pass;
          assert.equal(
            (await f.delivery(f.alerts[1].id)).status,
            "pending",
            "a different item belongs to the newer sender even at the same claim timestamp",
          );
          assert.equal((await f.delivery(f.alerts[1].id)).attempts, MAX_DELIVERY_ATTEMPTS);
          nextFinish.release();
          await nextPass;
          assert.equal((await f.delivery(f.alerts[1].id)).status, "sent");
          assert.equal((await f.delivery()).status, outcome.status);
        } finally {
          finish.release();
          nextFinish.release();
          await Promise.all([pass, nextPass]);
          await f.finish();
        }
      });
  },
);

test(
  "real PostgreSQL: every captured pre-send cleanup preserves a same-clock replacement's claim",
  { skip: !url },
  async (t) => {
    for (const path of ["unseen", "outside", "no longer allowed"])
      await t.test(path, async () => {
        const f = await fixture();
        const entered = gate(),
          finish = gate();
        let nextPass, pass;
        try {
          let item = f.alerts[0].id,
            lead,
            membership;
          if (path === "unseen") {
            const advanced = await f.demo({ type: "ADVANCE_CLOCK", role: "demo", minutes: 30 });
            const before = new Set(f.alerts.map(({ id }) => id));
            const fresh = engine.actNowAlerts(advanced, new Date(start)).find(({ id }) => !before.has(id));
            assert.ok(fresh, "a real clock advance raises a new alert that a reset will remove");
            item = fresh.id;
          } else {
            lead = await f.store.viewer(f.colleague, { bootstrap: true });
            const unit = f.world.state.units.find(
              (unit) =>
                engine.scopedActNowAlerts(
                  f.world,
                  { role: "ward", scope: { kind: "ward", unitIds: [unit.id] } },
                  new Date(start),
                ).length,
            );
            assert.ok(unit);
            const scope = { kind: "ward", unitIds: [unit.id] };
            item = engine.scopedActNowAlerts(f.world, { role: "ward", scope }, new Date(start))[0].id;
            const granted = await f.store.grantAccess(lead, {
              actorId: f.actor,
              role: "ward",
              scope,
              expiresAt: new Date(start + 3_600_000),
            });
            assert.equal(granted.status, 200);
            membership = granted.body.membership.id;
            assert.equal(await f.store.subscribe(f.actor, f.subscription, membership), "subscribed");
          }
          await f.queue(item);
          const next = f.make(f.workspaceId, async () => {
            entered.release();
            await finish.promise;
            return { outcome: "sent" };
          });
          let claimed = false,
            replaced = false,
            membershipReads = 0,
            revoked = false,
            oldSends = 0;
          async function replace() {
            assert.equal(replaced, false);
            replaced = true;
            if (path === "unseen") await f.demo({ type: "ADVANCE_CLOCK", role: "demo", minutes: 30 });
            assert.equal(await next.subscribe(f.actor, f.subscription), "subscribed");
            await f.queue(item);
            nextPass = next.sweepPush();
            await within(entered.promise);
          }
          const adapter = {
            connect: () => f.pool.connect(),
            async query(sql, params) {
              const result = await f.pool.query(sql, params);
              if (sql.startsWith("UPDATE ward_flow.push_deliveries d SET attempts =")) {
                claimed = true;
                if (path === "unseen") await f.demo({ type: "RESET_SCENARIO", role: "demo" });
                if (path === "outside") {
                  assert.equal((await f.store.revokeAccess(lead, membership)).status, 200);
                  revoked = true;
                }
              } else if (claimed && !replaced) {
                if (path === "unseen" && sql.startsWith("SELECT payload")) await replace();
                if (sql.startsWith("SELECT id, actor_id, role, scope, kind FROM ward_flow.memberships")) {
                  membershipReads++;
                  if (path === "outside" || (path === "no longer allowed" && membershipReads === 2)) await replace();
                }
                if (
                  path === "no longer allowed" &&
                  sql.startsWith("SELECT actor_id, role, scope") &&
                  sql.includes("kind='cover'") &&
                  !revoked
                ) {
                  assert.equal((await f.store.revokeAccess(lead, membership)).status, 200);
                  revoked = true;
                }
              }
              return result;
            },
          };
          pass = f
            .make(
              f.workspaceId,
              async () => {
                oldSends++;
                return { outcome: "sent" };
              },
              adapter,
            )
            .sweepPush();
          await pass;
          assert.equal(replaced, true, "the replacement must overlap the captured cleanup");
          assert.equal(oldSends, 0, "the old snapshot must select the intended cleanup path");
          const pending = await f.delivery(item);
          assert.ok(pending, "the replacement's pending claim must not be deleted");
          assert.equal(pending.status, "pending");
          assert.equal(pending.attempts, 1, "an unseen old claim cannot release the new claim");
          assert.equal(pending.last_attempt_at.getTime(), start);
          assert.equal((await f.registration()).last_success_at, null);
          finish.release();
          await nextPass;
          assert.equal((await f.delivery(item)).status, "sent");
          assert.equal(
            f.logs.some(({ event }) => event === "ward_backend_push_delivery_unavailable"),
            false,
          );
        } finally {
          finish.release();
          await Promise.all([pass, nextPass]);
          await f.finish();
        }
      });
  },
);

test(
  "real PostgreSQL: acknowledgement and a replacing evaluation cannot deadlock through the delivery foreign key",
  { skip: !url },
  async () => {
    const f = await fixture();
    const entered = gate(),
      finish = gate(),
      acknowledging = gate();
    const writer = await f.pool.connect();
    let pass,
      inTransaction = false,
      ackPid;
    const adapter = {
      query: (sql, params) => f.pool.query(sql, params),
      async connect() {
        const client = await f.pool.connect();
        return {
          release: client.release.bind(client),
          async query(sql, params) {
            if (
              sql.startsWith("SELECT s.id FROM ward_flow.push_subscriptions") ||
              (sql.includes("FROM ward_flow.workspaces") && sql.includes("FOR KEY SHARE"))
            ) {
              ackPid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
              acknowledging.release();
            }
            return client.query(sql, params);
          },
        };
      },
    };
    try {
      await f.queue();
      pass = f
        .make(
          f.workspaceId,
          async () => {
            entered.release();
            await finish.promise;
            return { outcome: "sent" };
          },
          adapter,
        )
        .sweepPush();
      await within(entered.promise);
      await writer.query("BEGIN");
      inTransaction = true;
      await writer.query("SELECT id FROM ward_flow.workspaces WHERE id=$1 FOR UPDATE", [f.workspaceId]);
      // These are evaluatePush's actual delete and fresh-item INSERT, including the FK check.
      // The writer owns the workspace and old D row before the outstanding result resumes.
      await writer.query(
        "DELETE FROM ward_flow.push_deliveries d USING ward_flow.push_subscriptions s WHERE d.subscription_id = s.id AND s.workspace_id=$1 AND NOT (d.item_id = ANY($2::text[]))",
        [f.workspaceId, [f.alerts[1].id]],
      );
      finish.release();
      await within(acknowledging.promise);
      let blocked = false;
      for (let attempt = 0; attempt < 100 && !blocked; attempt++) {
        const state = await f.pool.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [ackPid]);
        blocked = state.rows[0]?.wait_event_type === "Lock";
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(blocked, true, "the acknowledgement must overlap the evaluation's held locks");
      let queueFailure;
      try {
        await writer.query(
          "INSERT INTO ward_flow.push_deliveries(subscription_id, item_id) SELECT s.id, item FROM ward_flow.push_subscriptions s CROSS JOIN unnest($4::text[]) AS item WHERE s.workspace_id=$1 AND s.data_mode='prototype' AND s.revoked_at IS NULL AND s.actor_id = ANY($2::uuid[]) AND ($3::uuid IS NULL OR s.actor_id <> $3::uuid) ON CONFLICT (subscription_id, item_id) DO UPDATE SET status='pending', attempts=0, last_attempt_at=NULL",
          [f.workspaceId, [f.actor], null, [f.alerts[1].id]],
        );
        await writer.query("COMMIT");
      } catch (error) {
        queueFailure = error;
        await writer.query("ROLLBACK");
      }
      inTransaction = false;
      await pass;
      assert.equal(queueFailure, undefined, "a successful evaluation must not become a PostgreSQL deadlock victim");
      assert.deepEqual(f.logs, [], "the acknowledgement must not become a PostgreSQL deadlock victim");
      assert.equal(await f.delivery(), undefined);
      assert.equal((await f.delivery(f.alerts[1].id)).status, "pending");
      assert.equal((await f.delivery(f.alerts[1].id)).attempts, 0);
      assert.equal((await f.registration()).last_success_at, null);
    } finally {
      finish.release();
      if (inTransaction) await writer.query("ROLLBACK");
      writer.release();
      await pass;
      await f.finish();
    }
  },
);
