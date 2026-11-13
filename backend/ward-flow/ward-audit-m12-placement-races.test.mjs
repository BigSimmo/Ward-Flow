// @ts-check
// Audit M12: no bed is given to two people when two desks act at once. One race per screen that
// places someone, each on its own synthetic workspace in CI's isolated loopback PostgreSQL
// (WARD_TEST_DATABASE_URL). The bed meeting pull race is postgres.test.mjs "two accounts competing
// for the last bed have exactly one winner"; it is not repeated here. No provider is contacted.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { dropTestDatabase } from "./drop-test-database.test-support.mjs";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Placement race tests require isolated loopback PostgreSQL");

// The seed this clock produces is the one the fixtures below were checked against; each race first
// proves both commands are accepted on their own and that the second is refused after the first.
const AT = new Date("2026-10-07T10:00:00Z");
const C = "coordinator";

/**
 * Every (ward, bed number) that more than one person holds or occupies at once. A stay, a movement
 * accepted into a named bed and an accepted referral holding a named bed all claim the bed; claims
 * by the same person (a pulled stay and its own movement, say) are one claim.
 */
function bedClaims(state) {
  const claims = new Map();
  const claim = (unitId, bed, who) => {
    if (bed === undefined || bed === null) return;
    const key = `${unitId} bed ${bed}`;
    if (!claims.has(key)) claims.set(key, new Set());
    claims.get(key).add(who);
  };
  const referralPatient = new Map(state.referrals.map((referral) => [referral.id, referral.patientId]));
  for (const stay of state.admissions)
    if (stay.state === "occupied" || stay.state === "pulled")
      claim(stay.unitId, stay.bedNumber, stay.patientId ?? stay.id);
  for (const movement of state.movements)
    if (movement.closure === undefined && movement.acceptedUnitId)
      claim(
        movement.acceptedUnitId,
        movement.heldBedNumber,
        movement.patientId ?? referralPatient.get(movement.referralId) ?? movement.id,
      );
  for (const referral of state.referrals)
    for (const arm of referral.destinations)
      if (arm.state === "accepted" && arm.destination.kind === "psychiatric_ward")
        claim(arm.acceptedUnitId ?? arm.destination.unitId, arm.heldBedNumber, referral.patientId ?? referral.id);
  return claims;
}
const doubleClaims = (state) => [...bedClaims(state)].filter(([, who]) => who.size > 1).map(([key]) => key);

const SCENARIOS = [
  {
    screen: "ward Bed board place: two stays moved into one free bed",
    first: { type: "PLACE_IN_BED", role: C, admissionId: "AD-RPHS-01", bedNumber: 1 },
    second: { type: "PLACE_IN_BED", role: C, admissionId: "AD-RPHS-02", bedNumber: 1 },
    bed: "rph-adult-secure bed 1",
  },
  {
    screen: "referral named-bed hold: two accepted referrals pull one bed",
    first: {
      type: "HOLD_REFERRAL_BED",
      role: C,
      referralId: "RF-003",
      unitId: "scgh-adult-open",
      actingUnitId: "scgh-adult-open",
      bedNumber: 1,
    },
    second: {
      type: "HOLD_REFERRAL_BED",
      role: C,
      referralId: "RF-019",
      unitId: "scgh-adult-open",
      actingUnitId: "scgh-adult-open",
      bedNumber: 1,
    },
    bed: "scgh-adult-open bed 1",
  },
  {
    // The second contender was the worked example RF-RD06. Worked examples are opt-in since PR C
    // (A16-14, D-197 item 14), so the shared seed has no second referral for this bed; the ward
    // moving one of its own stays into the same bed contests it instead.
    screen: "front door referral accepted into a named bed while the ward moves a stay into it",
    first: {
      type: "ACCEPT_REFERRAL",
      role: C,
      referralId: "RF-011",
      destinationKind: "psychiatric_ward",
      unitId: "scgh-adult-open",
      bedNumber: 1,
    },
    second: { type: "PLACE_IN_BED", role: C, admissionId: "AD-SCGA-01", bedNumber: 1 },
    bed: "scgh-adult-open bed 1",
  },
  {
    screen: "ED movement placed in a named bed while the ward moves a stay into it",
    first: { type: "ACCEPT_IN_PRINCIPLE", role: C, movementId: "WF-010", unitId: "sjgm-adult-open", bedNumber: 1 },
    second: { type: "PLACE_IN_BED", role: C, admissionId: "AD-SJGA-01", bedNumber: 1 },
    bed: "sjgm-adult-open bed 1",
  },
  {
    screen: "arrival confirmed by two desks at once",
    first: { type: "PATIENT_ARRIVED", role: C, movementId: "WF-014" },
    second: { type: "PATIENT_ARRIVED", role: "ward", actingUnitId: "rph-adult-secure", movementId: "WF-014" },
    arrival: "WF-014",
  },
];

test(
  "real PostgreSQL: every placing screen gives a contested bed to exactly one person",
  { skip: !url, timeout: 120_000 },
  async (t) => {
    const engine = await import("./dist/engine.mjs");
    const admin = new Pool({ connectionString: url, max: 1 });
    const database = `wardflow_m12_${randomUUID().replaceAll("-", "")}`;
    const target = new URL(/** @type {string} */ (url));
    target.pathname = `/${database}`;
    await admin.query(`CREATE DATABASE ${database}`);
    const pool = new Pool({ connectionString: target.href, max: 6 });
    try {
      await migrate(pool);
      const seed = engine.seedWorld(AT);
      assert.deepEqual(doubleClaims(seed.state), [], "the seed itself gives no bed twice");
      for (const scenario of SCENARIOS)
        await t.test(scenario.screen, async () => {
          // The fixture must be a real contest: each is accepted alone, and the second is refused once
          // the first has happened. Otherwise the race below would prove nothing.
          const alone = [scenario.first, scenario.second].map((event) => engine.applyCommand(seed, event, AT));
          assert.deepEqual(
            alone.map((result) => result.outcome),
            ["accepted", "accepted"],
            "both commands must be eligible on their own",
          );
          assert.notEqual(
            engine.applyCommand(alone[0].world, scenario.second, AT).outcome,
            "accepted",
            "the second command must be refused after the first",
          );

          const workspaceId = randomUUID();
          const actors = [randomUUID(), randomUUID()];
          const stores = actors.map(() => createWorkspaceStore(pool, { workspaceId, engine, clock: () => AT }));
          assert.equal((await stores[0].read(actors[0])).revision, 1);
          const commandIds = [randomUUID(), randomUUID()];
          // Both desks saw revision 1 and press at the same moment.
          const results = await Promise.all([
            stores[0].command(actors[0], commandIds[0], 1, scenario.first),
            stores[1].command(actors[1], commandIds[1], 1, scenario.second),
          ]);
          const statuses = results.map((result) => result.status);
          assert.equal(statuses.filter((status) => status === 200).length, 1, `one winner, got ${statuses}`);
          assert.ok(
            statuses.every((status) => [200, 409, 422].includes(status)),
            `the other is refused or stale, got ${statuses}`,
          );

          const board = (await createWorkspaceStore(pool, { workspaceId, engine, clock: () => AT }).read(actors[0]))
            .payload.state;
          assert.deepEqual(doubleClaims(board), [], "no bed is held or occupied by two people");
          if (scenario.bed)
            assert.equal(bedClaims(board).get(scenario.bed)?.size, 1, "the contested bed went to the winner");
          if (scenario.arrival) {
            const movement = board.movements.find((row) => row.id === scenario.arrival);
            assert.equal(movement.stage, "arrived", "the arrival is recorded");
            const stays = board.admissions.filter(
              (stay) => stay.patientId === movement.patientId && (stay.state === "occupied" || stay.state === "pulled"),
            );
            assert.ok(stays.length <= 1, "one arrival never makes two current stays for one person");
            assert.equal(
              movement.stageChanges.filter((change) => change.to === "arrived").length,
              1,
              "the arrival is recorded once",
            );
          }

          // The audit names both attempts, the winner accepted and the loser not.
          const { rows } = await pool.query(
            "SELECT actor_id, command_id, outcome FROM ward_flow.audit WHERE workspace_id=$1 AND command_id = ANY($2::uuid[]) ORDER BY sequence",
            [workspaceId, commandIds],
          );
          assert.equal(rows.length, 2);
          assert.equal(rows.filter((row) => row.outcome === "accepted").length, 1);
          const winner = statuses.indexOf(200);
          assert.equal(rows.find((row) => row.outcome === "accepted").actor_id, actors[winner]);
          assert.equal(rows.find((row) => row.outcome === "accepted").command_id, commandIds[winner]);
        });
    } finally {
      await pool.end();
      await dropTestDatabase(admin, database);
      await admin.end();
    }
  },
);
