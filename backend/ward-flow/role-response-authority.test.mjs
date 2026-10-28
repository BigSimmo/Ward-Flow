// @ts-check
// Offline store boundary: real engine, a strict in-memory SQL scheduling double, synthetic data.
import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "./dist/engine.mjs";
import { createWorkspaceStore } from "./postgres.mjs";

const at = new Date("2026-10-27T04:00:00Z");
const actorId = "11111111-1111-4111-8111-111111111111";
const membershipId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "33333333-3333-4333-8333-333333333333";
const ownEvent = "audit-break-glass-21";
const foreignEvent = "audit-break-glass-22";
const access = { role: "coordinator", scope: { kind: "service", service: "North Metro" } };

function review(world, eventId) {
  const result = engine.applyCommand(
    world,
    {
      type: "REVIEW_AUDIT_EVENT",
      role: "coordinator",
      eventId,
      expectedGeneration: world.state.worldGeneration,
      expectedReviewCount: 0,
      decision: "reviewed",
    },
    at,
  );
  assert.equal(result.outcome, "accepted");
  return result.world;
}

function fixture() {
  let world = engine.seedWorld(at);
  const ownState = engine.scopeWorld(world, access, at).state;
  const ownIds = new Set(ownState.patients.map((row) => row.id));
  const own = ownState.patients[0]?.id;
  const foreign = world.state.patients.find((row) => !ownIds.has(row.id))?.id;
  assert.ok(own && foreign, "Synthetic scope has both own and foreign records");
  world = review(review(world, ownEvent), foreignEvent);
  return {
    world,
    openings: [
      { id: "21", patient_id: own },
      { id: "22", patient_id: foreign },
    ],
  };
}

function setup(
  { world, openings },
  {
    suppliedEngine = engine,
    currentAccess = access,
    grants = /** @type {Array<{ patient_id: string, until: Date }>} */ ([]),
  } = {},
) {
  let resolvedAccess = currentAccess;
  let stored = { data_mode: "prototype", revision: 7, payload: structuredClone(world), cache_updated_at: new Date(at) };
  const receipts = new Map();
  const queries = [];
  let locked = false;
  const query = async (sql, values = []) => {
    queries.push(sql);
    if (sql === "BEGIN") return { rows: [] };
    if (sql === "COMMIT" || sql === "ROLLBACK") {
      locked = false;
      return { rows: [] };
    }
    if (sql.startsWith("SELECT max(version)")) return { rows: [{ version: 8 }] };
    if (sql.includes("FROM ward_flow.workspaces") && sql.includes("FOR ")) {
      assert.match(sql, /FOR (SHARE|UPDATE)$/);
      locked = true;
      return { rows: [structuredClone(stored)] };
    }
    if (sql.startsWith("SELECT id, role, scope")) {
      assert.equal(locked, true, "Membership is re-resolved after acquiring the workspace lock");
      return {
        rows: [{ id: membershipId, ...resolvedAccess, kind: "role", expires_at: new Date(at.getTime() + 3_600_000) }],
      };
    }
    if (sql.startsWith("SELECT patient_id, opened_at, until")) return { rows: grants };
    if (sql.includes("FROM ward_flow.break_glass")) {
      assert.equal(locked, true, "Opening authority uses the same locked connection");
      const ids = values.find(Array.isArray) ?? [values[0]];
      assert.ok(values.includes(workspaceId), "Opening lookup is bound to this workspace");
      return { rows: openings.filter((row) => ids.includes(row.id)).map((row) => structuredClone(row)) };
    }
    if (sql.startsWith("SELECT fingerprint, status, result")) {
      const receipt = receipts.get(values[2]);
      return { rows: receipt ? [structuredClone(receipt)] : [], rowCount: receipt ? 1 : 0 };
    }
    if (sql.startsWith("UPDATE ward_flow.workspaces SET revision")) {
      stored = { ...stored, revision: values[1], payload: structuredClone(values[2]), cache_updated_at: values[3] };
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("INSERT INTO ward_flow.commands")) {
      receipts.set(values[2], { fingerprint: values[3], status: values[4], result: structuredClone(values[5]) });
      return { rows: [] };
    }
    if (sql.startsWith("INSERT INTO ward_flow.audit")) return { rows: [] };
    assert.fail(`Unexpected SQL in offline authority double: ${sql.slice(0, 100)}`);
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const store = createWorkspaceStore(pool, {
    workspaceId,
    engine: suppliedEngine,
    clock: () => new Date(at),
    log: () => assert.fail("Unexpected diagnostic"),
  });
  const view = { actorId, membershipId, version: 8, access, grants: [], accessUntil: at.getTime() + 3_600_000 };
  return {
    store,
    view,
    queries,
    receipts,
    world: () => stored.payload,
    setAccess: (next) => {
      resolvedAccess = next;
    },
  };
}

const undo = (world, reviewId) => ({
  type: "UNDO_AUDIT_REVIEW",
  role: "coordinator",
  reviewId,
  expectedGeneration: world.state.worldGeneration,
});

test("a locked snapshot returns own opening reviews and excludes foreign or missing openings", async () => {
  const input = fixture();
  input.world = review(input.world, "audit-break-glass-23");
  const { store, view, queries } = setup(input);
  const snapshot = await store.read(actorId, view);
  assert.deepEqual(
    snapshot.payload.state.auditReviews.map((row) => row.eventId),
    [ownEvent],
  );
  assert.equal(
    queries.filter((sql) => /SELECT .*id.*patient_id.*FROM ward_flow.break_glass/.test(sql)).length,
    1,
    "One batched authority lookup per locked world",
  );
});

test("opening review commands retain the existing own-place rule and do not distinguish foreign from missing targets", async () => {
  const input = fixture();
  input.openings.push({ id: "24", patient_id: input.openings[0].patient_id });
  const { store, view } = setup(input);
  const event = (eventId) => ({
    type: "REVIEW_AUDIT_EVENT",
    role: "coordinator",
    eventId,
    expectedGeneration: input.world.state.worldGeneration,
    expectedReviewCount: 0,
    decision: "reviewed",
  });
  const accepted = await store.command(actorId, "synthetic-own-review", 7, event("audit-break-glass-24"), { view });
  assert.equal(accepted.status, 200);
  assert.deepEqual(
    accepted.body.snapshot.payload.state.auditReviews.map((row) => row.eventId),
    [ownEvent, "audit-break-glass-24"],
  );
  const foreign = await store.command(
    actorId,
    "synthetic-foreign-review",
    8,
    { ...event(foreignEvent), expectedReviewCount: 1 },
    { view },
  );
  const absent = await store.command(actorId, "synthetic-absent-review", 8, event("audit-break-glass-25"), { view });
  assert.equal(foreign.status, 422);
  assert.equal(absent.status, 422);
  assert.equal(foreign.body.error, absent.body.error);
  assert.equal(foreign.body.code, "scope");
});

test("the store independently refuses foreign opening undo even if the pure command check were to permit it", async () => {
  const input = fixture();
  const foreign = input.world.state.auditReviews.find((row) => row.eventId === foreignEvent);
  assert.ok(foreign);
  const { store, view, world } = setup(input, { suppliedEngine: { ...engine, commandRefusal: () => null } });
  const response = await store.command(actorId, "synthetic-foreign-undo", 7, undo(input.world, foreign.id), { view });
  assert.equal(response.status, 422);
  assert.equal(response.body.code, "scope");
  assert.equal(world().state.auditReviews.length, 2);
});

test("the composed store gives an unknown and a foreign review undo the same refusal", async () => {
  const input = fixture();
  const review = input.world.state.auditReviews.find((row) => row.eventId === foreignEvent);
  assert.ok(review);
  const { store, view, world } = setup(input);
  const foreign = await store.command(actorId, "synthetic-real-foreign-undo", 7, undo(input.world, review.id), {
    view,
  });
  const absent = await store.command(
    actorId,
    "synthetic-real-absent-undo",
    7,
    undo(input.world, `${review.id}-absent`),
    { view },
  );
  assert.equal(foreign.status, 422);
  assert.equal(absent.status, foreign.status);
  assert.equal(foreign.body.code, "scope");
  assert.equal(absent.body.code, foreign.body.code);
  assert.equal(absent.body.error, foreign.body.error);
  assert.equal(world().state.auditReviews.length, 2);
});

test("an authoritative own opening review remains undoable and its retry does not repeat the change", async () => {
  const input = fixture();
  const own = input.world.state.auditReviews.find((row) => row.eventId === ownEvent);
  assert.ok(own);
  const { store, view, world } = setup(input);
  const event = undo(input.world, own.id);
  const response = await store.command(actorId, "synthetic-own-undo", 7, event, { view });
  assert.equal(response.status, 200);
  assert.equal(
    world().state.auditReviews.some((row) => row.eventId === ownEvent),
    false,
  );
  const replay = await store.command(actorId, "synthetic-own-undo", 7, event, { view });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(world().state.auditReviews.length, 1);
});

test("a grant cannot widen review authority and the current membership is resolved inside the lock", async () => {
  const input = fixture();
  const foreign = input.world.state.auditReviews.find((row) => row.eventId === foreignEvent);
  assert.ok(foreign);
  const granted = setup(input, {
    grants: [{ patient_id: input.openings[1].patient_id, until: new Date(at.getTime() + 60_000) }],
  });
  const denied = await granted.store.command(actorId, "synthetic-granted-undo", 7, undo(input.world, foreign.id), {
    view: granted.view,
  });
  assert.equal(denied.status, 422);
  assert.equal(denied.body.code, "scope");
  const own = input.world.state.auditReviews.find((row) => row.eventId === ownEvent);
  assert.ok(own);
  const changed = setup(input, {
    currentAccess: { role: "coordinator", scope: { kind: "service", service: "South Metro" } },
  });
  const afterChange = await changed.store.command(actorId, "synthetic-scope-ended-undo", 7, undo(input.world, own.id), {
    view: changed.view,
  });
  assert.equal(afterChange.status, 422);
  assert.equal(afterChange.body.code, "scope");
  assert.equal(
    afterChange.body.snapshot.payload.state.auditReviews.some((row) => row.eventId === ownEvent),
    false,
  );
});

test("replay and conflicting-command replies use freshly prepared current review authority", async () => {
  const input = fixture();
  input.openings.push({ id: "24", patient_id: input.openings[0].patient_id });
  const { store, view, setAccess } = setup(input);
  const event = {
    type: "REVIEW_AUDIT_EVENT",
    role: "coordinator",
    eventId: "audit-break-glass-24",
    expectedGeneration: input.world.state.worldGeneration,
    expectedReviewCount: 0,
    decision: "reviewed",
  };
  const first = await store.command(actorId, "synthetic-replay-review", 7, event, { view });
  assert.equal(first.status, 200);
  setAccess({ role: "coordinator", scope: { kind: "service", service: "South Metro" } });
  const replay = await store.command(actorId, "synthetic-replay-review", 7, event, { view });
  assert.equal(replay.body.replayed, true);
  assert.equal(Object.hasOwn(replay.body, "covered"), false);
  assert.equal(
    replay.body.snapshot.payload.state.auditReviews.some((row) => [ownEvent, event.eventId].includes(row.eventId)),
    false,
  );
  const conflict = await store.command(
    actorId,
    "synthetic-replay-review",
    7,
    { ...event, decision: "follow-up-required" },
    { view },
  );
  assert.equal(conflict.status, 422);
  assert.equal(
    conflict.body.snapshot.payload.state.auditReviews.some((row) => [ownEvent, event.eventId].includes(row.eventId)),
    false,
  );
});

test("the response derives its allowed opening IDs against the resulting world, not the pre-command population", async () => {
  const input = fixture();
  input.openings.push({ id: "24", patient_id: input.openings[0].patient_id });
  const suppliedEngine = {
    ...engine,
    scopeWorld: (...args) => {
      const scoped = engine.scopeWorld(...args);
      // A focused scheduling seam for any accepted transition/archive that removes a subject
      // from this desk's population. Retain auditReviews so a stale pre-command allowlist leaks.
      return args[0].state.auditReviews.length === 3
        ? { ...scoped, state: { ...scoped.state, patients: [], movements: [], referrals: [] } }
        : scoped;
    },
  };
  const { store, view } = setup(input, { suppliedEngine });
  const response = await store.command(
    actorId,
    "synthetic-resulting-world",
    7,
    {
      type: "REVIEW_AUDIT_EVENT",
      role: "coordinator",
      eventId: "audit-break-glass-24",
      expectedGeneration: input.world.state.worldGeneration,
      expectedReviewCount: 0,
      decision: "reviewed",
    },
    { view },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.snapshot.payload.state.auditReviews, []);
});
