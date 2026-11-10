// @ts-check
// Master audit M30 (10 Nov 2026): the referral closed loop. For each pair of the six referral
// actions (accept, accept in principle, decline, withdraw acceptance, withdraw referral, assign),
// a race leaves one outcome and one owner, so a patient cannot fall between wards.
//
// Two layers, both on synthetic seed records only:
// 1. Offline, always run: each pair applied in both orders through the real engine, which is
//    what the shared store serialises a race into (the loser is refused or re-read and re-sent).
// 2. Real PostgreSQL, run when WARD_TEST_DATABASE_URL names a loopback server (CI's Postgres job):
//    the pair sent at once through two stores at the same base revision.
//
// The six actions act on two kinds of record. A front-door referral is accepted, declined and
// assigned (ACCEPT_REFERRAL, DECLINE_REFERRAL, ASSIGN_REFERRAL). A bed request is accepted in
// principle, declined, and has its acceptance or the whole referral withdrawn (ACCEPT_IN_PRINCIPLE,
// DECLINE, WITHDRAW_ACCEPTANCE, WITHDRAW_REFERRAL). "Decline" is the record's own decline. A pair
// on the same record must leave exactly one winner; a pair on two records must keep both.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

const AT = new Date("2026-10-10T10:00:00Z");
// "acuity_mix" is a true decline: "no_suitable_bed" waitlists instead and keeps the ward asked.
// Seed records: WF-013 is in ward review, referred to Bentley Older Adult (open). RF-011 is a
// front-door referral with a queued ward destination.
const MOVEMENT = "WF-013";
const WARD = "bty-older-adult";
const REFERRAL = "RF-011";
const REFERRAL_WARD = "fre-adult-open";

/** @typedef {"accept" | "acceptInPrinciple" | "decline" | "withdrawAcceptance" | "withdrawReferral" | "assign"} Action */
/** @type {readonly Action[]} */
const ACTIONS = ["accept", "acceptInPrinciple", "decline", "withdrawAcceptance", "withdrawReferral", "assign"];
/** Actions on the front-door referral; the rest act on the bed request. */
const ON_REFERRAL = new Set(["accept", "assign"]);

/**
 * The command for an action. `decline` declines whichever record its partner acts on, so the pair
 * contends for one destination where the model allows it.
 * @param {Action} action @param {"referral" | "movement"} declineOn
 */
function command(action, declineOn) {
  switch (action) {
    case "accept":
      return {
        type: "ACCEPT_REFERRAL",
        role: "coordinator",
        referralId: REFERRAL,
        destinationKind: "psychiatric_ward",
        unitId: REFERRAL_WARD,
      };
    case "assign":
      return { type: "ASSIGN_REFERRAL", role: "coordinator", referralId: REFERRAL, owner: "ed" };
    case "decline":
      return declineOn === "referral"
        ? {
            type: "DECLINE_REFERRAL",
            role: "coordinator",
            referralId: REFERRAL,
            destinationKind: "psychiatric_ward",
            reason: "acuity_mix",
          }
        : { type: "DECLINE", role: "coordinator", movementId: MOVEMENT, unitId: WARD, reason: "acuity_mix" };
    case "acceptInPrinciple":
      return { type: "ACCEPT_IN_PRINCIPLE", role: "coordinator", movementId: MOVEMENT, unitId: WARD };
    case "withdrawAcceptance":
      return { type: "WITHDRAW_ACCEPTANCE", role: "coordinator", movementId: MOVEMENT, reason: "the_decision_changed" };
    case "withdrawReferral":
      return { type: "WITHDRAW_REFERRAL", role: "coordinator", movementId: MOVEMENT };
  }
}

/** Every unordered pair of the six actions: 15. */
const PAIRS = ACTIONS.flatMap((a, i) => ACTIONS.slice(i + 1).map((b) => /** @type {[Action, Action]} */ ([a, b])));

/** Which record each side acts on, and the base the pair starts from. */
function plan(/** @type {[Action, Action]} */ [a, b]) {
  const declineOn = ON_REFERRAL.has(a === "decline" ? b : a) ? "referral" : "movement";
  const target = (/** @type {Action} */ action) =>
    action === "decline" ? declineOn : ON_REFERRAL.has(action) ? "referral" : "movement";
  // Withdrawing an acceptance needs one to withdraw: the bed request starts accepted at the ward.
  const acceptedFirst = a === "withdrawAcceptance" || b === "withdrawAcceptance";
  // Once accepted, the request cannot be accepted or declined again, so those two partners are
  // refused from the shared base: the withdrawal is the only outcome that race can have.
  const refusedAtBase =
    acceptedFirst && [a, b].some((action) => action === "acceptInPrinciple" || action === "decline");
  return {
    refusedAtBase,
    first: command(a, declineOn),
    second: command(b, declineOn),
    sameRecord: target(a) === target(b),
    acceptedFirst,
  };
}

function baseWorld(engine, acceptedFirst) {
  let world = engine.seedWorld(AT);
  if (acceptedFirst) {
    const accepted = engine.applyCommand(world, { now: 0, ...command("acceptInPrinciple", "movement") }, AT);
    assert.equal(accepted.outcome, "accepted", "the fixture must accept the bed request first");
    world = accepted.world;
  }
  return world;
}

const ACCEPTED_STAGES = new Set(["accepted_awaiting_bed", "pulled", "moving", "handover_ready"]);

/**
 * One outcome and one owner for both destinations. Returns the outcome words so callers can
 * compare orders.
 */
function assertOneOutcome(engine, world, label) {
  assert.ok(engine.validWorld(world), `${label}: the workspace stays valid`);
  const movement = world.state.movements.find((row) => row.id === MOVEMENT);
  assert.ok(movement, `${label}: the bed request still exists`);
  const declinedHere = movement.declines.some((decline) => decline.unitId === WARD);
  const accepted = movement.acceptedUnitId !== undefined;
  const withdrawn = movement.closure !== undefined;
  // Never both accepted and declined at one ward, never accepted and withdrawn at once.
  assert.ok(!(accepted && withdrawn), `${label}: a withdrawn bed request holds no acceptance`);
  assert.ok(!(accepted && movement.acceptedUnitId === WARD && declinedHere), `${label}: not accepted and declined`);
  // A closed request keeps the stage it closed at; only an open one must agree with its acceptance.
  if (accepted) assert.ok(ACCEPTED_STAGES.has(movement.stage), `${label}: an acceptance sits at an accepted stage`);
  else if (!withdrawn) assert.ok(!ACCEPTED_STAGES.has(movement.stage), `${label}: no accepted stage without one`);
  // A ward that declined is no longer asked, so it cannot also be waiting to answer.
  if (declinedHere && !accepted) assert.ok(!movement.referredUnitIds.includes(WARD), `${label}: declined is not asked`);
  // One owner: the bed request always names who holds it.
  assert.equal(typeof movement.owner, "string", `${label}: the bed request has an owner`);
  assert.notEqual(movement.owner.trim(), "", `${label}: the bed request has an owner`);
  const referral = world.state.referrals.find((row) => row.id === REFERRAL);
  assert.ok(referral, `${label}: the referral still exists`);
  const ward = referral.destinations.filter((row) => row.destination.kind === "psychiatric_ward");
  assert.equal(ward.length, 1, `${label}: one ward destination on the referral`);
  const [destination] = ward;
  if (destination.state === "accepted")
    assert.equal(destination.acceptedUnitId, REFERRAL_WARD, `${label}: an accepted destination names its ward`);
  else assert.equal(destination.acceptedUnitId, undefined, `${label}: only an accepted destination names a ward`);
  const owners = referral.ownerHistory ?? [];
  assert.ok(owners.length <= 1, `${label}: one assignment, never two owners`);
  return {
    movement: withdrawn
      ? "withdrawn"
      : accepted
        ? `accepted:${movement.acceptedUnitId}`
        : declinedHere
          ? "declined"
          : "open",
    referral: destination.state,
    owner: owners.at(-1)?.owner ?? "none",
  };
}

test("M30 offline: every pair of the six referral actions, in either order, leaves one outcome and one owner", async (t) => {
  const engine = await import("./dist/engine.mjs");
  assert.equal(PAIRS.length, 15);
  for (const pair of PAIRS) {
    await t.test(pair.join(" vs "), () => {
      const { first, second, sameRecord, acceptedFirst, refusedAtBase } = plan(pair);
      const base = baseWorld(engine, acceptedFirst);
      for (const action of [first, second]) {
        const refused = refusedAtBase && action.type !== "WITHDRAW_ACCEPTANCE";
        assert.equal(
          engine.applyCommand(base, { now: 0, ...action }, AT).outcome,
          refused ? "denied" : "accepted",
          refused
            ? `${action.type} is refused once the request is accepted`
            : `${action.type} must be allowed on its own, or the race proves nothing`,
        );
      }
      for (const [x, y] of [
        [first, second],
        [second, first],
      ]) {
        const one = engine.applyCommand(base, { now: 0, ...x }, AT);
        if (one.outcome !== "accepted") {
          assert.ok(refusedAtBase, `${x.type} was allowed alone`);
          assertOneOutcome(engine, base, `${x.type} refused`);
          continue;
        }
        const two = engine.applyCommand(one.world, { now: 0, ...y }, AT);
        // The later action is either refused, leaving the winner's outcome, or applied to it.
        const world = two.outcome === "accepted" ? two.world : one.world;
        assertOneOutcome(engine, world, `${x.type} then ${y.type}`);
        // Two actions on different records never cancel each other.
        if (!sameRecord) assert.equal(two.outcome, "accepted", `${y.type} still applies after ${x.type}`);
      }
    });
  }
});

test(
  "M30 real PostgreSQL: each pair sent at once from one revision leaves one winner and one outcome",
  { skip: !url, timeout: 120_000 },
  async (t) => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 8 });
    pool.on("error", () => {});
    const actorA = randomUUID();
    const actorB = randomUUID();
    try {
      await migrate(pool);
      for (const pair of PAIRS) {
        await t.test(pair.join(" vs "), async () => {
          const { first, second, sameRecord, acceptedFirst, refusedAtBase } = plan(pair);
          const workspaceId = randomUUID();
          const storeA = createWorkspaceStore(pool, { workspaceId, engine, clock: () => AT });
          const storeB = createWorkspaceStore(pool, { workspaceId, engine, clock: () => AT });
          await storeA.ready();
          let revision = (await storeA.read(actorA)).revision;
          if (acceptedFirst) {
            const setup = await storeA.command(actorA, randomUUID(), revision, {
              now: 0,
              ...command("acceptInPrinciple", "movement"),
            });
            assert.equal(setup.status, 200, "the fixture must accept the bed request first");
            revision = setup.body.snapshot.revision;
          }
          const results = await Promise.all([
            storeA.command(actorA, randomUUID(), revision, { now: 0, ...first }),
            storeB.command(actorB, randomUUID(), revision, { now: 0, ...second }),
          ]);
          const statuses = results.map((result) => result.status);
          assert.ok(statuses.includes(200), `one of ${first.type} and ${second.type} wins (${statuses})`);
          // A loser is a conflict (409), or a refusal (422) when it no longer applies to the winner's state.
          for (const status of statuses) assert.ok([200, 409, 422].includes(status), `unexpected status ${status}`);
          if (sameRecord || refusedAtBase)
            assert.equal(statuses.filter((status) => status === 200).length, 1, "same record: exactly one winner");
          else assert.deepEqual(statuses, [200, 200], "different records: both are kept");
          const final = await storeA.read(actorA);
          const outcome = assertOneOutcome(engine, final.payload, pair.join(" vs "));
          // The loser left no accepted audit row: one accepted row per winner.
          const audit = (await storeA.audit()).filter((row) => row.outcome === "accepted");
          const winners = results.filter((result) => result.status === 200).length;
          assert.equal(
            audit.filter((row) => [first.type, second.type].includes(row.action)).length -
              (acceptedFirst && [first.type, second.type].includes("ACCEPT_IN_PRINCIPLE") ? 1 : 0),
            winners,
            `${JSON.stringify(outcome)}: one accepted audit row per winner`,
          );
        });
      }
    } finally {
      await pool.end();
    }
  },
);
