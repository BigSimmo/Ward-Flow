// @ts-check
// Audit M113: backend read scoping per desk, against real PostgreSQL. One synthetic canary patient
// lies on ward B (FSH Adult Secure, South Metro). Every desk whose place is on the ward A side (RPH,
// East Metro) must get no trace of it from any read route: not its name, UMRN, ids, a count or an
// audit row. Two workspaces run the same steps, one with the canary and one without it; each ward A
// side desk's reply must be the same in both, and the canary workspace's reply must not name it.
// Search, the TV board, statistics and the downtime pack are drawn in the browser from these
// replies (the browser never reads the database, migration 006), so the routes below cover them.
// Synthetic data only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { createSharedHandler } from "./shared-http.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

// The real clock: the HTTP layer checks each desk's access deadline against it. The service
// executive's report on later demo days is covered in role-aggregate-privacy.test.mjs (D-125).
const start = new Date(Math.floor(Date.now() / 60_000) * 60_000);
const WARD_A = "rph-adult-secure";
const WARD_B = "fsh-adult-secure";
const CANARY_ADMISSION = "AD-FSHS-04";
const CANARY_PATIENT = "PT-G-AD-FSHS-04";
/**
 * A closed FSH ED journey. Its closing is moved 45 days back in both workspaces, so the first
 * archive pass moves it to the archive; in the canary workspace the canary is its patient.
 */
const CANARY_JOURNEY = "WF-314";
/** The twin workspace's ward B desk works on this admission instead, so both run the same steps. */
const TWIN_ADMISSION = "AD-FSHS-05";
const CANARY = Object.freeze({ givenName: "Canaryzq", familyName: "Syntheticzq", umrn: "UM999913" });
/**
 * Anything that would show the canary reached a desk. The closed FSH journey is ward B's side in both
 * workspaces (the twin holds it too, under its seed patient), so no ward A side desk is sent its id
 * in either; in the canary workspace it is the canary's, and its archived row must not reach them.
 */
const CANARY_TRACES = [
  CANARY.givenName,
  CANARY.familyName,
  CANARY.umrn,
  CANARY_PATIENT,
  CANARY_ADMISSION,
  CANARY_JOURNEY,
];

const lead = "a0000000-0000-4000-8000-000000000001";
const wardBActor = "a0000000-0000-4000-8000-000000000002";
/** The ward A side desks, one per kind of place that exists. Fixed actor ids, the same in both workspaces. */
const DESKS = Object.freeze([
  {
    name: "ward A",
    actorId: "b0000000-0000-4000-8000-000000000001",
    role: "ward",
    scope: { kind: "ward", unitIds: [WARD_A] },
  },
  {
    name: "ED at site A",
    actorId: "b0000000-0000-4000-8000-000000000002",
    role: "ed",
    scope: { kind: "ed", edId: "rph-ed" },
  },
  {
    name: "site A bed manager",
    actorId: "b0000000-0000-4000-8000-000000000003",
    role: "bed_manager",
    scope: { kind: "site", siteCode: "RPH" },
  },
  {
    name: "service A coordinator",
    actorId: "b0000000-0000-4000-8000-000000000004",
    role: "coordinator",
    scope: { kind: "service", service: "East Metro" },
  },
  {
    name: "service A access admin",
    actorId: "b0000000-0000-4000-8000-000000000005",
    role: "admin",
    scope: { kind: "service", service: "East Metro" },
  },
  {
    name: "service A executive",
    actorId: "b0000000-0000-4000-8000-000000000006",
    role: "executive",
    scope: { kind: "service", service: "East Metro" },
  },
  {
    name: "service A transport jobs",
    actorId: "b0000000-0000-4000-8000-000000000007",
    role: "officer",
    scope: { kind: "jobs", service: "East Metro" },
  },
  {
    name: "service A community team",
    actorId: "b0000000-0000-4000-8000-000000000008",
    role: "community",
    scope: { kind: "team", teamName: "Midland Community Team" },
  },
]);
/** The ward B desk command, the same id in both workspaces, so its receipt is asked for by id. */
const WARD_B_COMMAND = "c0000000-0000-4000-8000-000000000001";

/** The seed world with the canary placed on ward B, or with no canary at all (the twin). */
function seededWorld(engine, at, withCanary) {
  const world = engine.seedWorld(at);
  const admission = world.state.admissions.find((row) => row.id === CANARY_ADMISSION);
  assert.equal(admission?.unitId, WARD_B, "the canary admission is on ward B");
  assert.equal(admission.patientId, CANARY_PATIENT);
  const journey = world.state.movements.find((row) => row.id === CANARY_JOURNEY);
  assert.equal(journey?.originEdId, "fsh-ed");
  journey.closure = { ...journey.closure, at: journey.closure.at - 45 * 1440 };
  if (withCanary) {
    const patient = world.state.patients.find((row) => row.id === CANARY_PATIENT);
    Object.assign(patient, { ...CANARY, preferredName: CANARY.givenName });
    journey.patientId = CANARY_PATIENT;
  } else {
    world.state.admissions = world.state.admissions.filter((row) => row.id !== CANARY_ADMISSION);
    world.state.patients = world.state.patients.filter((row) => row.id !== CANARY_PATIENT);
  }
  assert.ok(engine.validWorld(JSON.parse(JSON.stringify(world))));
  return world;
}

function observationToken(row) {
  return JSON.stringify([
    "admission",
    row.id,
    row.observation.level,
    row.observation.intervalMinutes,
    row.observation.reviewAt,
    row.observationChanges?.length ?? 0,
  ]);
}

/** One workspace, its store and its HTTP handler, run through the same steps with or without the canary. */
async function workspace(engine, pool, withCanary) {
  const workspaceId = randomUUID();
  const now = start.getTime();
  const store = createWorkspaceStore(pool, {
    workspaceId,
    engine: { ...engine, seedWorld: (at) => seededWorld(engine, at, withCanary) },
    clock: () => new Date(now),
  });
  const handler = createSharedHandler({
    config: { coordinatorIds: [lead], workspaceId },
    store,
    authenticate: async (header, context) => {
      context.session.startedAt = Date.now();
      context.session.signedInAt = Date.now();
      context.session.sessionId = "d0000000-0000-4000-8000-000000000001";
      return String(header).replace(/^Bearer /, "");
    },
    readBody: async (request) => request.json(),
    verifierUnavailable: Error,
    log: () => {},
  });
  /** @param {string} path @param {{ actorId: string, membershipId?: string | null, method?: string, body?: unknown, screen?: string }} desk */
  const call = async (path, { actorId, membershipId = null, method = "GET", body, screen }) => {
    const headers = { authorization: `Bearer ${actorId}` };
    if (membershipId) headers["x-ward-working-as"] = membershipId;
    if (screen) headers["x-ward-screen"] = screen;
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await handler(
      new Request(`https://example.test${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    return { status: response.status, body: await response.json() };
  };
  const leadDesk = { actorId: lead };
  const seeded = await call("/v1/workspace", leadDesk);
  assert.equal(seeded.status, 200, JSON.stringify(seeded.body));
  const leadView = await store.viewer(lead, { bootstrap: true });
  const grant = async (actorId, role, scope) => {
    const result = await store.grantAccess(leadView, {
      actorId,
      role,
      scope,
      expiresAt: new Date(now + 60 * 60_000),
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.membership.id;
  };
  const desks = [];
  for (const desk of DESKS) desks.push({ ...desk, membershipId: await grant(desk.actorId, desk.role, desk.scope) });
  const wardB = {
    actorId: wardBActor,
    membershipId: await grant(wardBActor, "ward", { kind: "ward", unitIds: [WARD_B] }),
  };

  // The statewide lead saves until the every-20-revisions archive pass has run.
  for (let step = 0; step < 40; step++) {
    const current = await store.read(lead, leadView);
    if (current.archived > 0) break;
    const saved = await call("/v1/workspace/commands", {
      ...leadDesk,
      method: "POST",
      body: {
        classification: "synthetic",
        commandId: randomUUID(),
        expectedRevision: current.revision,
        event: { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: WARD_B },
      },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
  }
  // Ward B's desk changes the canary's observation level (an audit row) and opens its record (a
  // record access row). The twin's ward B desk does the same to another ward B patient.
  const wardBRead = await call("/v1/workspace", wardB);
  assert.equal(wardBRead.status, 200);
  const target = withCanary ? CANARY_ADMISSION : TWIN_ADMISSION;
  const admission = wardBRead.body.snapshot.payload.state.admissions.find((row) => row.id === target);
  const changed = await call("/v1/workspace/commands", {
    ...wardB,
    method: "POST",
    body: {
      classification: "synthetic",
      commandId: WARD_B_COMMAND,
      expectedRevision: wardBRead.body.snapshot.revision,
      event: {
        type: "RECORD_OBSERVATION_LEVEL",
        role: "ward",
        now: engine.worldNow(wardBRead.body.snapshot.payload, new Date(now)),
        target: { kind: "admission", admissionId: target, actingUnitId: WARD_B },
        observation: { level: "two_staff", intervalMinutes: null, reviewAt: null },
        expected: observationToken(admission),
      },
    },
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.outcome ?? "accepted", "accepted", JSON.stringify(changed.body).slice(0, 300));
  const opened = await call("/v1/workspace/record-access", {
    ...wardB,
    method: "POST",
    body: { patientId: admission.patientId, surface: "patient" },
  });
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  return { workspaceId, engine, call, desks, lead: leadDesk, wardB };
}

/**
 * Every read route a desk can call, by the name used in the test titles. Each answers what that
 * desk is sent. The poll forms read after a full read so they can name the revision and context.
 */
const READ_PATHS = Object.freeze({
  "workspace snapshot": (space, desk) => space.call("/v1/workspace", desk),
  "TV board snapshot": (space, desk) => space.call("/v1/workspace", { ...desk, screen: "tv" }),
  "incremental read (changed since revision 1)": (space, desk) => space.call("/v1/workspace?since=1", desk),
  "incremental read (unchanged)": async (space, desk) => {
    const full = await space.call("/v1/workspace", desk);
    const context = full.body.snapshot?.partialView?.accessContext;
    const query = `since=${full.body.snapshot?.revision ?? 1}${context ? `&context=${context}` : ""}`;
    return space.call(`/v1/workspace?${query}`, desk);
  },
  "activity and audit log page": (space, desk) => space.call("/v1/workspace/audit", desk),
  "record access log": (space, desk) => space.call("/v1/workspace/record-access", desk),
  "record access log for the canary": (space, desk) =>
    space.call(`/v1/workspace/record-access?patient=${CANARY_PATIENT}`, desk),
  "archive (History)": (space, desk) => space.call("/v1/workspace/archive", desk),
  "forecast history": (space, desk) => space.call("/v1/workspace/forecast-history", desk),
  "command receipt for ward B's change": (space, desk) =>
    space.call(`/v1/workspace/receipt?commandId=${WARD_B_COMMAND}`, desk),
  "access directory": (space, desk) => space.call("/v1/workspace/access", desk),
  "cover list": (space, desk) => space.call("/v1/workspace/access/cover", desk),
  // Last, because it saves: the reply to the desk's own change carries its board too.
  "reply to the desk's own change": async (space, desk) => {
    const full = await space.call("/v1/workspace", desk);
    const payload = full.body.snapshot?.payload;
    const unit = payload?.state?.units?.find((row) => row.id === WARD_A);
    // A ward desk restates its own empty beds; a coordinator asks for a refresh. Another desk's
    // refusal is a reply too, and is held to the same rule.
    const event =
      desk.role === "ward" && unit
        ? {
            type: "CONFIRM_CAPACITY",
            role: "ward",
            now: space.engine.worldNow(payload, new Date()),
            unitId: WARD_A,
            actingUnitId: WARD_A,
            value: unit.empty.value,
            expectedRevision: unit.allocatable?.revision ?? 0,
          }
        : { type: "REQUEST_CAPACITY_REFRESH", role: desk.role, unitId: WARD_A };
    const saved = await space.call("/v1/workspace/commands", {
      ...desk,
      method: "POST",
      body: {
        classification: "synthetic",
        commandId: randomUUID(),
        expectedRevision: full.body.snapshot?.revision ?? 1,
        event,
      },
    });
    if (["ward", "coordinator"].includes(desk.role)) assert.equal(saved.status, 200, JSON.stringify(saved.body));
    return saved;
  },
});

/**
 * What each desk is answered, so a route that starts refusing everyone cannot pass by sending
 * nothing. The record access log is the statewide, service coordinator and access admin's only.
 */
const snapshotFor = () => 200;
const recordsFor = (desk) => (desk.role === "executive" ? 403 : 200);
const accessLogFor = (desk) => (["coordinator", "admin"].includes(desk.role) ? 200 : 403);
/** The access directory is the access admin's; a place's coordinator is refused it like any other desk. */
const directoryFor = (desk) => (desk.role === "admin" ? 200 : 403);
const EXPECTED_STATUS = Object.freeze({
  "workspace snapshot": snapshotFor,
  "TV board snapshot": snapshotFor,
  "incremental read (changed since revision 1)": snapshotFor,
  "incremental read (unchanged)": snapshotFor,
  "activity and audit log page": recordsFor,
  "record access log": accessLogFor,
  "record access log for the canary": accessLogFor,
  "archive (History)": recordsFor,
  // Every desk keeps its own forecast history (migration 16), and is told which cover it holds or granted.
  "forecast history": snapshotFor,
  "command receipt for ward B's change": snapshotFor,
  "access directory": directoryFor,
  "cover list": snapshotFor,
});

/** Values that differ between any two workspaces whatever they hold: ids, clocks and hashes. */
const VOLATILE_KEYS = new Set([
  "workspaceId",
  "serverTime",
  "receiptScope",
  "accessUntil",
  "workingAs",
  "membershipId",
  "grantedAt",
  "granted_at",
  "expiresAt",
  "expires_at",
  "lastUsedAt",
  "last_used_at",
  "committed_at",
  "committedAt",
  "openedAt",
  "opened_at",
  "viewedAt",
  "viewed_at",
  "accessContext",
  "updatedAt",
  "requestId",
  // The audit sequence is one counter for every workspace in the database.
  "sequence",
  "nextCursor",
]);
function normalised(value, ids) {
  // Lists are compared as sets: the access directory orders desks by membership id, which differs
  // between the two workspaces. A missing or extra entry still differs.
  if (Array.isArray(value))
    return value
      .map((entry) => normalised(entry, ids))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        (VOLATILE_KEYS.has(key) && (typeof entry === "string" || typeof entry === "number")) ||
        // A database row number, one counter for every workspace; record ids are never bare digits.
        (key === "id" && typeof entry === "string" && /^\d+$/.test(entry))
          ? "<volatile>"
          : normalised(entry, ids),
      ]),
    );
  if (typeof value === "string") return ids.reduce((text, [from, to]) => text.replaceAll(from, to), value);
  return value;
}

describe(
  "M113: a ward A side desk gets no trace of a ward B canary from any read route",
  { skip: !url, timeout: 240_000 },
  () => {
    /** @type {any} */
    let engine;
    /** @type {Pool} */
    let pool;
    /** @type {any} */
    let canary;
    /** @type {any} */
    let twin;
    before(async () => {
      engine = await import("./dist/engine.mjs");
      pool = new Pool({ connectionString: url, max: 6 });
      await migrate(pool);
      canary = await workspace(engine, pool, true);
      twin = await workspace(engine, pool, false);
    });
    after(async () => {
      await pool?.end();
    });

    test("the canary is really there: ward B and the statewide lead see it on every route that shows it", async () => {
      const lead = canary.lead;
      const board = JSON.stringify((await canary.call("/v1/workspace", lead)).body);
      for (const trace of [CANARY.givenName, CANARY.umrn, CANARY_PATIENT]) assert.ok(board.includes(trace), trace);
      const wardB = JSON.stringify((await canary.call("/v1/workspace", canary.wardB)).body);
      assert.ok(wardB.includes(CANARY.familyName));
      const audit = await canary.call("/v1/workspace/audit", lead);
      assert.ok(JSON.stringify(audit.body).includes(CANARY_ADMISSION), "the statewide audit names the change");
      const wardBAudit = await canary.call("/v1/workspace/audit", canary.wardB);
      assert.ok(wardBAudit.body.events.some((event) => event.action === "RECORD_OBSERVATION_LEVEL"));
      const log = await canary.call("/v1/workspace/record-access", lead);
      assert.ok(JSON.stringify(log.body).includes(CANARY_PATIENT), "the statewide access log names the opening");
      const archive = await canary.call("/v1/workspace/archive", lead);
      assert.ok(
        archive.body.records.some(
          (record) => record.body.id === CANARY_JOURNEY && record.body.patientId === CANARY_PATIENT,
        ),
        "the canary's closed journey is in the archive",
      );
      const receipt = await canary.call(`/v1/workspace/receipt?commandId=${WARD_B_COMMAND}`, canary.wardB);
      assert.ok(receipt.body.receipt, "ward B reads its own receipt");
    });

    for (const desk of DESKS)
      for (const [route, read] of Object.entries(READ_PATHS))
        test(`${desk.name}: ${route}`, async () => {
          const inCanary = canary.desks.find((row) => row.name === desk.name);
          const inTwin = twin.desks.find((row) => row.name === desk.name);
          // Both workspaces take every step, even when the first reply already fails, so they stay alike.
          const seen = await read(canary, inCanary);
          const other = await read(twin, inTwin);
          const text = JSON.stringify(seen.body);
          const expected = EXPECTED_STATUS[route]?.(desk);
          if (expected) assert.equal(seen.status, expected, `${desk.name} ${route} answers ${expected}`);
          for (const trace of CANARY_TRACES)
            assert.equal(text.includes(trace), false, `${desk.name} ${route} names ${trace}: ${seen.status}`);
          // A desk's Activity feed carries no change facts, only kinds and times. Ward B's change to
          // the canary is the only observation change made, so its row must not be among them.
          for (const event of seen.body.events ?? [])
            assert.notEqual(event.action, "RECORD_OBSERVATION_LEVEL", `${desk.name} reads ward B's audit row`);
          // Ward B's command receipt is ward B's own; another desk is told nothing about it.
          if (route === "command receipt for ward B's change") assert.equal(seen.body.receipt, null);
          // No count either: the reply is the same as in the workspace that never held the canary.
          assert.equal(seen.status, other.status);
          const ids = (space) => [
            [space.workspaceId, "<workspace>"],
            ...space.desks.map((row) => [row.membershipId, `<desk ${row.name}>`]),
            [space.wardB.membershipId, "<ward B desk>"],
          ];
          assert.deepEqual(normalised(seen.body, ids(canary)), normalised(other.body, ids(twin)));
        });
  },
);
