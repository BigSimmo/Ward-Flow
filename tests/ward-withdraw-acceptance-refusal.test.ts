/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, MovementStage } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { collectedBlockedReason, enRouteBlockedReason } from "@/components/ward-management/officer/officer-screen";

/**
 * 🔴 A REFUSAL MAY NOT TELL A COORDINATOR A BED WAS PULLED WHEN NO BED EXISTS.
 *
 * `WITHDRAW_ACCEPTANCE`'s stage guard used to read *"cannot withdraw an acceptance once a bed has
 * been pulled"*. The guard is `movement.stage !== "accepted_awaiting_bed"` — it tests one
 * CONDITION, not one cause, and five stages can reach it:
 *
 *     placement_requested   before any acceptance; NO BED EXISTS TO HAVE BEEN PULLED
 *     destination_review    before any acceptance; NO BED EXISTS TO HAVE BEEN PULLED
 *     pulled                a bed was pulled                                    (the claim held)
 *     handover_ready        after `pulled`                                      (the claim held)
 *     moving                after `pulled`                                      (the claim held)
 *
 * ⚠️ **`arrived` never reaches the guard**: its only writer sets `closure` in the same object
 * literal as the stage, so the closure branch above returns first. **Five reachable, not the six a
 * subtraction from `MOVEMENT_STAGES` suggests** — what the type can express is not what the code
 * can reach.
 *
 * 🔴 **IT WAS TRUE THREE TIMES OUT OF FIVE, AND THAT IS WHY IT SURVIVED.** Wrong only at the two
 * EARLIEST stages; right at the three where a withdrawal is most plausibly attempted. Anyone
 * checking it from a realistic mid-pathway movement read an accurate sentence and moved on. **A
 * falsehood with a high true rate is harder to find than one with a low one**, and a test written
 * from a typical case cannot find it at all.
 *
 * ⚠️ And it was ACTIONABLE: *"a bed has been pulled"* tells a coordinator a bed left the pool.
 * They go looking for it, or stop chasing one they still need. A refusal that says nothing wastes
 * seconds; one that says the wrong specific thing sends somebody somewhere.
 */

/** The clause the old sentence asserted. Matched loosely on purpose — a rewording that keeps the
 *  claim in different words is the thing this file exists to refuse. */
const CLAIMS_A_BED_WAS_PULLED = /bed\s+has\s+been\s+pulled|bed\s+was\s+pulled/i;

/**
 * 🔴 THE TWO STAGES WHERE THE CLAIM IS FALSE — AND DELIBERATELY NOT ALL FIVE.
 *
 * At `pulled`, `handover_ready` and `moving` a bed genuinely has been pulled, so a blanket "this
 * message never mentions a pulled bed" assertion would be **RED ON CORRECT WORK**. A guard that
 * fires on correct work teaches people to ignore it, which is worse than not having it.
 */
const STAGES_WITH_NO_BED_YET: readonly MovementStage[] = ["placement_requested", "destination_review"];

function openMovementAt(state: WardFlowState, stage: MovementStage): Movement | undefined {
  return state.movements.find((candidate) => candidate.stage === stage && candidate.closure === undefined);
}

function withdraw(state: WardFlowState, movementId: string): WardFlowState {
  return wardFlowReducer(state, {
    type: "WITHDRAW_ACCEPTANCE",
    role: "coordinator",
    movementId,
    reason: "recorded_in_error",
    now: NOW_ANCHOR,
  });
}

describe("withdrawing an acceptance is refused without inventing a cause", () => {
  /**
   * The anti-vacuity floor for the whole file. Both cases below depend on the seed actually
   * carrying an open movement at each pre-acceptance stage; without one they would skip silently.
   */
  it("the seed carries an open movement at each stage where no bed can exist yet", () => {
    const state = seedWardFlowState();
    for (const stage of STAGES_WITH_NO_BED_YET) {
      expect(
        openMovementAt(state, stage),
        `no open seeded movement at ${stage} - the case for it would prove nothing`,
      ).toBeDefined();
    }
    expect(STAGES_WITH_NO_BED_YET.length, "the stage list emptied - every case below would be skipped").toBe(2);
  });

  it.each(STAGES_WITH_NO_BED_YET)("refuses at %s without claiming a bed was pulled", (stage) => {
    const state = seedWardFlowState();
    const movement = openMovementAt(state, stage);

    /*
     * 🔴 THE FLOOR IS STRUCTURAL, NOT A STRING MATCH, AND THAT IS THE POINT.
     *
     * An absence assertion passes over an event that never reached the guard at all: a
     * `WITHDRAW_ACCEPTANCE` refused for a MISSING MOVEMENT or a CLOSED one returns a different
     * message, which also lacks the false clause, and would sail through. These three
     * preconditions prove which branch fired without pinning any wording — the movement exists
     * (so not the not-found branch), it is open (so not the closure branch), and its stage is not
     * `accepted_awaiting_bed` (so the stage guard is the one that returns).
     */
    expect(movement, `no open seeded movement at ${stage}`).toBeDefined();
    expect(movement!.closure, "a closed movement is refused by a different branch entirely").toBeUndefined();
    expect(movement!.stage, "fixture drifted off the stage this case is about").toBe(stage);

    const after = withdraw(state, movement!.id);

    expect(
      after.rejections.length,
      "no rejection was raised - the event was accepted, so there is no message to assert about",
    ).toBe(state.rejections.length + 1);

    const refusal = after.rejections[after.rejections.length - 1]!.reason;
    expect(refusal.length, "the refusal carries no text").toBeGreaterThan(0);

    expect(
      refusal,
      `the refusal shown at ${stage} claims a bed was pulled. No bed exists at this stage, so that ` +
        `is a false and ACTIONABLE statement: a coordinator goes looking for a bed that was never ` +
        `taken. State the CONDITION the guard tests, not a cause guessed from one of the five ` +
        `stages that reach it. Refusal was: "${refusal}"`,
    ).not.toMatch(CLAIMS_A_BED_WAS_PULLED);
  });

  /**
   * ⚠️ A BEHAVIOUR CHECK, NOT A WORDING ONE — the repair must not have widened the gate.
   *
   * Rewording a refusal is one keystroke away from deleting the branch that raises it, and every
   * assertion above would still pass if the guard simply stopped refusing: no rejection, no
   * message, nothing claiming a pulled bed. This case fails if a later stage becomes withdrawable.
   */
  it("still refuses at a stage after the bed was pulled", () => {
    const state = seedWardFlowState();
    const movement = openMovementAt(state, "pulled") ?? openMovementAt(state, "moving");
    expect(movement, "no open seeded movement past acceptance - this case would prove nothing").toBeDefined();

    const after = withdraw(state, movement!.id);
    expect(after.rejections.length, "a withdrawal past acceptance was ACCEPTED - the gate has widened").toBe(
      state.rejections.length + 1,
    );
  });
});

/**
 * 🔴 TWO MORE REFUSALS THAT NAMED A CAUSE THEIR GUARD NEVER CHECKED — SAME CLASS, SAME STAGE.
 *
 * `TRANSPORT_EN_ROUTE` and `PATIENT_COLLECTED` each guard on
 * `stage !== "handover_ready" || !transport?.<field>`, and each message asserted the SECOND half as
 * though it were the only cause. At stage `moving` the FIRST half fires while the transport field
 * IS set — so both told a coordinator transport had not reached a state it had demonstrably passed.
 *
 * ⚠️ **`moving` is only reachable by having already succeeded at these very events**, and neither
 * `transport.acceptedAt` nor `transport.enRouteAt` is ever cleared (one writer each). So the false
 * case is not a corner — it is what a coordinator meets on a stale button or an out-of-order retry
 * after the patient has already been collected.
 */
describe("a transport refusal does not deny a state the movement has already passed", () => {
  /** A movement at `moving` has, by construction, passed both transport gates. */
  function openMovingMovement(state: WardFlowState): Movement | undefined {
    return state.movements.find((candidate) => candidate.stage === "moving" && candidate.closure === undefined);
  }

  it("the seed carries an open movement at moving, with both transport stamps set", () => {
    const state = seedWardFlowState();
    const movement = openMovingMovement(state);
    expect(movement, "no open seeded movement at moving - both cases below would prove nothing").toBeDefined();
    /*
     * 🔴 THE FLOOR THAT MATTERS. If the fixture reached `moving` WITHOUT these stamps, the old
     * messages would have been TRUE there and the cases below would pass while proving the
     * opposite of what they claim.
     */
    expect(movement!.transport?.acceptedAt, "the fixture reached moving without transport accepted").toBeDefined();
    expect(movement!.transport?.enRouteAt, "the fixture reached moving without transport en route").toBeDefined();
  });

  it.each([
    ["TRANSPORT_EN_ROUTE", /not been accepted|before it has been accepted/i],
    ["PATIENT_COLLECTED", /before transport is en route|is not en route/i],
  ] as const)("%s does not deny a transport state that is already recorded", (type, deniesAPassedState) => {
    const state = seedWardFlowState();
    const movement = openMovingMovement(state);
    expect(movement, "no open seeded movement at moving").toBeDefined();

    const after = wardFlowReducer(state, {
      type,
      role: "officer",
      movementId: movement!.id,
      now: NOW_ANCHOR,
    } as never);

    // The structural floor: the guard was reached and refused, rather than the event being accepted
    // or turned away by the not-found or closure branch above it.
    expect(after.rejections.length, "no rejection was raised - there is no message to assert about").toBe(
      state.rejections.length + 1,
    );

    const refusal = after.rejections[after.rejections.length - 1]!.reason;
    expect(
      refusal,
      `${type}'s refusal at stage "moving" denies a transport state the movement has already ` +
        `passed. Both stamps are set by the time a movement is moving. Report the facts the guard ` +
        `checked; do not name one of them as the cause. Refusal was: "${refusal}"`,
    ).not.toMatch(deniesAPassedState);
  });
});

/**
 * 🔴 AND THE SAME TWO FALSEHOODS EXISTED A SECOND TIME, ON THE SCREEN THE OFFICER READS FIRST.
 *
 * `enRouteBlockedReason` and `collectedBlockedReason` are deliberate MIRRORS of the reducer's
 * guards — their own comments say so — and they block the button BEFORE any event is dispatched.
 * So the officer meets the mirror's sentence, and only ever meets the reducer's if they get past it.
 *
 * ⚠️ **Repairing the reducer alone would have been the worse half of a half-fix**: the falser
 * surface is the one nearer the reader. The audit that found the reducer's three did not cover this
 * file, and a sweep scoped to the reducer would have reported the defect closed.
 */
describe("the officer screen's mirrored refusals do not deny a passed transport state", () => {
  it.each([
    ["enRouteBlockedReason", enRouteBlockedReason, /before it has been accepted|not been accepted/i],
    ["collectedBlockedReason", collectedBlockedReason, /before transport is en route|is not en route/i],
  ] as const)("%s does not deny a state the movement has already passed", (name, reasonFor, deniesAPassedState) => {
    const state = seedWardFlowState();
    const movement = state.movements.find(
      (candidate) => candidate.stage === "moving" && candidate.closure === undefined,
    );
    expect(movement, "no open seeded movement at moving - this case would prove nothing").toBeDefined();
    expect(movement!.transport?.acceptedAt, "fixture reached moving without transport accepted").toBeDefined();
    expect(movement!.transport?.enRouteAt, "fixture reached moving without transport en route").toBeDefined();

    const reason = reasonFor(movement!);
    // The floor: the mirror must actually BLOCK here. If it returned undefined there would be no
    // sentence, and an absence assertion over nothing passes while proving nothing.
    expect(reason, `${name} did not block at stage moving - there is no message to assert about`).toBeDefined();

    expect(
      reason,
      `${name} denies a transport state the movement has already passed. Both stamps are set by ` +
        `the time a movement is moving, and this is the sentence the officer reads BEFORE the ` +
        `reducer is ever reached. Reason was: "${reason}"`,
    ).not.toMatch(deniesAPassedState);
  });
});

/**
 * 🔴 A CAPACITY REFUSAL THAT NAMED A CAUSE NOBODY CHECKED — the third of the three this audit found.
 *
 * `PULL_PATIENT`'s guard is `unit.allocatable.value <= 0`. Its message used to carry the
 * `DECLINE_REASONS` code for a bed pulled for an earlier referral — a specific cause, for a guard
 * that tests one number.
 *
 * ⚠️ **`CONFIRM_CAPACITY` sets that number straight from a ward's own self-report.** So a ward can
 * correct its count to zero for a reason that has nothing to do with pulling, and a coordinator
 * attempting a pull was told an earlier referral had taken the bed. **They would go looking for the
 * patient who took it.**
 *
 * 🔴 **AND NO DISCRIMINATOR EXISTS, WHICH IS WHY THE CAUSE HAD TO GO RATHER THAN BE NARROWED.**
 * `allocatable.source` cannot separate the two: `PULL_PATIENT` decrements the value while spreading
 * the existing figure, preserving whatever source a prior `CONFIRM_CAPACITY` set.
 *
 * ⚠️ **The seeded pulling scenario could never have caught this**, because there pulls really did
 * exhaust the beds and the claim happened to be true. This case constructs the specimen where the
 * two readings disagree — the same remedy the legal-forms split needed.
 */
describe("a capacity refusal reports the count it read, not a cause it did not check", () => {
  it("does not claim a bed was pulled when a ward simply confirmed zero", () => {
    let state = seedWardFlowState();

    /*
     * ⚠️ THE SPECIMEN MUST REACH THE CAPACITY GUARD, AND MY FIRST ATTEMPT DID NOT. Picking any unit
     * with capacity and any open movement produced a refusal from the STAGE guard instead — the
     * movement was at "Placement requested" and never got near the allocatable check. The floor
     * below caught it, which is the whole reason it is written before the assertion rather than
     * after somebody notices a green that proved nothing.
     *
     * So the unit is chosen FROM an accepted movement: a pull is only reachable once a ward has
     * accepted in principle and the movement is awaiting that ward's bed.
     */
    const movement = state.movements.find(
      (candidate) =>
        candidate.closure === undefined &&
        candidate.stage === "accepted_awaiting_bed" &&
        candidate.acceptedUnitId !== undefined,
    );
    expect(
      movement,
      "no movement awaiting an accepted bed - a pull is unreachable and this proves nothing",
    ).toBeDefined();

    const unit = state.units.find((candidate) => candidate.id === movement!.acceptedUnitId);
    expect(unit, "the accepted unit is not in state").toBeDefined();

    // The ward restates its own count as zero. No pull anywhere in this sequence.
    state = wardFlowReducer(state, {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      unitId: unit!.id,
      actingUnitId: unit!.id,
      expectedRevision: unit!.allocatable.revision ?? 0,
      value: 0,
      now: NOW_ANCHOR,
    } as never);

    const confirmed = state.units.find((candidate) => candidate.id === unit!.id);
    expect(confirmed?.allocatable.value, "the ward's confirmation was refused - the specimen never formed").toBe(0);

    const before = state.rejections.length;
    const after = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      movementId: movement!.id,
      unitId: unit!.id,
      now: NOW_ANCHOR,
    } as never);

    expect(after.rejections.length, "the pull was accepted - there is no refusal to assert about").toBe(before + 1);
    const refusal = after.rejections[after.rejections.length - 1]!.reason;

    /*
     * ⚠️ THE FLOOR. This event can be refused by several earlier guards — a wrong role, a movement
     * at the wrong stage, an ineligible unit — and every one of those messages ALSO lacks the false
     * clause, so an absence assertion over them would pass while proving nothing. Requiring the
     * capacity sentence specifically proves the capacity guard is the one that answered.
     */
    expect(
      refusal,
      `the pull was refused by a different guard, so this case says nothing about the capacity ` +
        `message. Refusal was: "${refusal}"`,
    ).toContain("no allocatable bed remains");

    expect(
      refusal,
      `the refusal claims a bed was pulled for an earlier referral. No pull happened here - the ` +
        `ward confirmed zero. The guard reads one number and cannot tell the two apart, so it may ` +
        `report that number and must not name a cause. Refusal was: "${refusal}"`,
    ).not.toMatch(/bed_pulled_for_earlier_referral|earlier referral/);
  });
});
