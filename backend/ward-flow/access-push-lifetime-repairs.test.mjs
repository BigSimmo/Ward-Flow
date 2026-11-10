// @ts-check
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import * as engine from "./dist/engine.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Push lifetime tests require isolated loopback PostgreSQL");
const DAY = 86_400_000;
const start = new Date("2026-10-22T10:00:00Z");

async function fixture() {
  const pool = new Pool({ connectionString: url, max: 6 });
  const workspaceId = randomUUID(),
    lead = randomUUID(),
    legacyActor = randomUUID(),
    activeActor = randomUUID();
  let at = new Date(start),
    coverReadHook = null;
  const sent = [],
    logs = [];
  const adapter = {
    connect: () => pool.connect(),
    async query(sql, params) {
      const result = await pool.query(sql, params);
      if (coverReadHook && sql.startsWith("SELECT actor_id, role, scope") && sql.includes("kind='cover'")) {
        const hook = coverReadHook;
        coverReadHook = null;
        await hook();
      }
      return result;
    },
  };
  await migrate(pool);
  const store = createWorkspaceStore(adapter, {
    workspaceId,
    engine,
    clock: () => at,
    demoEvents: true,
    slowCommandMs: 60_000,
    log: (entry) => logs.push(entry),
    push: {
      coordinatorIds: [],
      maxPerAccount: 4,
      send: async (device) => {
        sent.push(device);
        return { outcome: "sent" };
      },
      payload: (items) => ({ count: items.length }),
    },
  });
  const leadView = await store.viewer(lead, { bootstrap: true });
  const initial = await store.read(lead, leadView);
  const advanced = engine.applyCommand(initial.payload, { type: "ADVANCE_CLOCK", role: "demo", minutes: 30 }, at).world;
  const currentRed = new Set(engine.actNowAlerts(initial.payload, at).map(({ id }) => id));
  const unit = initial.payload.state.units.find((candidate) =>
    engine
      .scopedActNowAlerts(advanced, { role: "ward", scope: { kind: "ward", unitIds: [candidate.id] } }, at)
      .some(({ id }) => !currentRed.has(id)),
  );
  assert.ok(unit, "normal scenario has a new in-scope red item after thirty minutes");
  const scope = { kind: "ward", unitIds: [unit.id] };
  const legacyId = randomUUID();
  const expiry = new Date(start.getTime() + 2 * engine.ACCESS_MAX_TERM_MINUTES * 60_000);
  assert.equal(
    (await store.grantAccess(leadView, { actorId: legacyActor, role: "ward", scope, expiresAt: expiry })).status,
    400,
  );
  // Supported historical state, not a newly valid grant: be3e445fa26fa682820f98c229f2d7cb9a5a63e5
  // grantAccess accepted this two-year term. fcd8b058d (23 Oct) capped future grants only;
  // cd3d4cbcb (24 Oct) ended old grants by age in viewer(), without a data-clamping migration.
  // The exact historical store API was separately executed against PostgreSQL for this repair.
  await pool.query(
    "INSERT INTO ward_flow.memberships(id,workspace_id,actor_id,role,scope,granted_by,granted_at,expires_at,last_used_at) VALUES($1,$2,$3,'ward',$4,$5,$6,$7,$6)",
    [legacyId, workspaceId, legacyActor, scope, lead, start, expiry],
  );
  const legacyView = () => store.viewer(legacyActor, { workingAs: legacyId });
  // Keep the old grant in use through supported reads, so inactivity is never the refusal cause.
  for (let day = 30; day < 365; day += 30) {
    at = new Date(start.getTime() + day * DAY);
    assert.equal((await legacyView()).status, "ok");
  }
  at = new Date(start.getTime() + 364 * DAY);
  assert.equal((await legacyView()).status, "ok");
  const fresh = await store.grantAccess(leadView, {
    actorId: activeActor,
    role: "ward",
    scope,
    expiresAt: new Date(at.getTime() + 7 * DAY),
  });
  assert.equal(fresh.status, 200);
  const activeId = fresh.body.membership.id;
  async function subscribe(actor, membershipId) {
    const endpoint = `https://synthetic.invalid/push/${randomUUID()}`;
    assert.equal(
      await store.subscribe(actor, { endpoint, p256dh: "synthetic-key", auth: "synthetic-auth" }, membershipId),
      "subscribed",
    );
    return (
      await pool.query("SELECT id FROM ward_flow.push_subscriptions WHERE workspace_id=$1 AND endpoint=$2", [
        workspaceId,
        endpoint,
      ])
    ).rows[0].id;
  }
  const legacyDevice = await subscribe(legacyActor, legacyId);
  const activeDevice = await subscribe(activeActor, activeId);
  const world = (await store.read(lead, leadView)).payload;
  const red = engine.scopedActNowAlerts(world, { role: "ward", scope }, at)[0];
  assert.ok(red, "pending retry concerns a real in-scope alert");
  return {
    pool,
    store,
    leadView,
    legacyView,
    legacyActor,
    activeActor,
    legacyId,
    activeId,
    legacyDevice,
    activeDevice,
    workspaceId,
    scope,
    sent,
    logs,
    setAge(milliseconds) {
      at = new Date(start.getTime() + milliseconds);
    },
    late(hook) {
      coverReadHook = hook;
    },
    async queue(devices = [legacyDevice, activeDevice]) {
      // This is the real outbox row shape left by an interrupted legitimate earlier send.
      for (const id of devices)
        await pool.query("INSERT INTO ward_flow.push_deliveries(subscription_id,item_id) VALUES($1,$2)", [id, red.id]);
    },
    async command(event) {
      const current = await store.read(lead, leadView);
      const result = await store.command(lead, randomUUID(), current.revision, event, { view: leadView });
      assert.equal(result.status, 200);
    },
    finish: () => pool.end(),
  };
}

test(
  "real PostgreSQL: a legacy term-ended desk receives neither fresh queued alerts nor retries",
  { skip: !url, timeout: 30_000 },
  async () => {
    const f = await fixture();
    try {
      await f.queue();
      f.setAge(engine.ACCESS_MAX_TERM_MINUTES * 60_000 + 1);
      assert.equal((await f.legacyView()).status, "none");
      await f.store.sweepPush();
      assert.deepEqual(
        f.sent.map(({ id }) => id),
        [f.activeDevice],
        "a valid desk still receives its pending alert",
      );
      assert.equal(f.logs.length, 0);
      f.sent.length = 0;
      await f.command({ type: "RESET_SCENARIO", role: "demo" });
      await f.command({ type: "ADVANCE_CLOCK", role: "demo", minutes: 30 });
      assert.ok(
        f.sent.some(({ id }) => id === f.activeDevice),
        "a valid desk receives newly raised in-scope alerts",
      );
      assert.equal(
        f.sent.some(({ id }) => id === f.legacyDevice),
        false,
      );
      const rows = await f.pool.query(
        "SELECT DISTINCT d.subscription_id::text AS id FROM ward_flow.push_deliveries d JOIN ward_flow.push_subscriptions s ON s.id=d.subscription_id WHERE s.workspace_id=$1 AND d.status='sent'",
        [f.workspaceId],
      );
      assert.equal(
        rows.rows.some(({ id }) => id === f.legacyDevice),
        false,
      );
      assert.equal(f.logs.length, 0);
    } finally {
      await f.finish();
    }
  },
);

test(
  "real PostgreSQL: a max-term boundary crossed during push scope loading prevents the pending send",
  { skip: !url, timeout: 30_000 },
  async () => {
    const f = await fixture();
    try {
      await f.queue([f.legacyDevice]);
      f.setAge(engine.ACCESS_MAX_TERM_MINUTES * 60_000 - 1);
      assert.equal((await f.legacyView()).status, "ok");
      f.late(() => f.setAge(engine.ACCESS_MAX_TERM_MINUTES * 60_000 + 1));
      await f.store.sweepPush();
      assert.equal((await f.legacyView()).status, "none");
      assert.equal(f.sent.length, 0);
      assert.equal(f.logs.length, 0);
    } finally {
      await f.finish();
    }
  },
);

test(
  "real PostgreSQL: membership revoked during push scope loading cannot send its queued alert",
  { skip: !url, timeout: 30_000 },
  async () => {
    const f = await fixture();
    try {
      await f.queue([f.legacyDevice]);
      f.late(async () => assert.equal((await f.store.revokeAccess(f.leadView, f.legacyId)).status, 200));
      await f.store.sweepPush();
      assert.equal((await f.legacyView()).status, "none");
      assert.equal(f.sent.length, 0);
      assert.equal(f.logs.length, 0);
    } finally {
      await f.finish();
    }
  },
);

test(
  "real PostgreSQL: a legacy term-ended role cannot qualify its holder for fresh cover",
  { skip: !url, timeout: 30_000 },
  async () => {
    const f = await fixture();
    try {
      f.setAge(engine.ACCESS_MAX_TERM_MINUTES * 60_000 + 1);
      assert.equal((await f.legacyView()).status, "none");
      const request = { scope: f.scope, minutes: 60, reason: "staff-away" };
      const refused = await f.store.giveCover(f.leadView, { ...request, actorId: f.legacyActor });
      assert.equal(refused.status, 422);
      const accepted = await f.store.giveCover(f.leadView, { ...request, actorId: f.activeActor });
      assert.equal(accepted.status, 200);
      assert.equal(f.logs.length, 0);
    } finally {
      await f.finish();
    }
  },
);

test(
  "real PostgreSQL: cover ending during push scope loading does not lend its earlier scope",
  { skip: !url, timeout: 30_000 },
  async () => {
    const f = await fixture();
    try {
      const world = (await f.store.read(f.leadView.actorId, f.leadView)).payload;
      const ownAlerts = new Set(
        engine
          .scopedActNowAlerts(world, { role: "ward", scope: f.scope }, new Date(start.getTime() + 364 * DAY))
          .map(({ id }) => id),
      );
      const target = world.state.units
        .map((unit) => ({
          unit,
          alerts: engine.scopedActNowAlerts(
            world,
            { role: "ward", scope: { kind: "ward", unitIds: [unit.id] } },
            new Date(start.getTime() + 364 * DAY),
          ),
        }))
        .find(({ alerts }) => alerts.some(({ id }) => !ownAlerts.has(id)));
      assert.ok(target, "another ward has a distinct red item");
      const item = target.alerts.find(({ id }) => !ownAlerts.has(id));
      const cover = await f.store.giveCover(f.leadView, {
        actorId: f.activeActor,
        scope: { kind: "ward", unitIds: [target.unit.id] },
        minutes: 30,
        reason: "busy",
      });
      assert.equal(cover.status, 200);
      await f.pool.query("INSERT INTO ward_flow.push_deliveries(subscription_id,item_id) VALUES($1,$2)", [
        f.activeDevice,
        item.id,
      ]);
      f.late(() => f.setAge(364 * DAY + 31 * 60_000));
      await f.store.sweepPush();
      assert.equal(f.sent.length, 0, "the surviving base membership cannot lend expired cover access");
      assert.equal(f.logs.length, 0);
    } finally {
      await f.finish();
    }
  },
);

test(
  "real PostgreSQL: mixed own and expired-cover alert batch records only the own alert as sent",
  { skip: !url, timeout: 30_000 },
  async () => {
    const f = await fixture();
    try {
      const world = (await f.store.read(f.leadView.actorId, f.leadView)).payload;
      const ownAlerts = new Set(
        engine
          .scopedActNowAlerts(world, { role: "ward", scope: f.scope }, new Date(start.getTime() + 364 * DAY))
          .map(({ id }) => id),
      );
      const target = world.state.units
        .map((unit) => ({
          unit,
          alerts: engine.scopedActNowAlerts(
            world,
            { role: "ward", scope: { kind: "ward", unitIds: [unit.id] } },
            new Date(start.getTime() + 364 * DAY),
          ),
        }))
        .find(({ alerts }) => alerts.some(({ id }) => !ownAlerts.has(id)));
      assert.ok(target, "another ward has a distinct red item");
      const item = target.alerts.find(({ id }) => !ownAlerts.has(id));
      const cover = await f.store.giveCover(f.leadView, {
        actorId: f.activeActor,
        scope: { kind: "ward", unitIds: [target.unit.id] },
        minutes: 30,
        reason: "busy",
      });
      assert.equal(cover.status, 200);
      await f.pool.query("INSERT INTO ward_flow.push_deliveries(subscription_id,item_id) VALUES($1,$2)", [
        f.activeDevice,
        item.id,
      ]);
      await f.queue([f.activeDevice]);
      f.late(() => f.setAge(364 * DAY + 31 * 60_000));
      await f.store.sweepPush();
      assert.equal(f.sent.length, 1, "the valid own-ward alert still sends");
      assert.ok(f.sent[0].items.length > 0);
      assert.ok(
        f.sent[0].items.every(({ id }) => ownAlerts.has(id)),
        "payload excludes expired-cover alerts",
      );
      const retained = await f.pool.query(
        "SELECT item_id, status FROM ward_flow.push_deliveries WHERE subscription_id=$1",
        [f.activeDevice],
      );
      assert.equal(retained.rows.length, 1);
      assert.equal(retained.rows[0].status, "sent");
      assert.ok(ownAlerts.has(retained.rows[0].item_id));
      assert.equal(
        retained.rows.some(({ item_id }) => item_id === item.id),
        false,
        "omitted expired-cover claim is removed, not recorded as sent",
      );
      assert.equal(f.logs.length, 0);
    } finally {
      await f.finish();
    }
  },
);
