import { describe, expect, it } from "vitest";

import { remainingHighAcuityCapacity } from "../src/components/ward-management/ward-admissions";
import { unitHasLockedBeds } from "../src/components/ward-management/ward-bed-designation";
import {
  GENDER_PLACEMENT_REASONS,
  OVERRIDE_REASONS,
  RELEASE_PULL_REASONS,
} from "../src/components/ward-management/ward-change-reasons";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Referral, Unit } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * Three engine defects confirmed by the 2026-09-14 review of the 62-issue catalogue
 * (`docs/ward-flow/PROJECT-ISSUES.md` §1a). Each block drives the REDUCER, pairs every refusal with
 * a positive control on the identical fixture, and would pass on a reducer that refused everything
 * only if its control also went red.
 *
 * The fourth defect in that section (a revoked examination leaving its admission behind) is pinned
 * by the existing test in `ward-flow-reducer.test.ts`, which was `it.fails` until it was fixed.
 */

const NOW = NOW_ANCHOR;

function unitIn(state: WardFlowState, id: string): Unit {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

function movementIn(state: WardFlowState, id: string): Movement {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

/**
 * A seeded unit with six free, allocatable, confirmed beds and nothing pending preparation, so that
 * "no bed" can never be the reason a pull below is refused.
 */
function widened(base: Unit, extra: Partial<Unit> = {}): Unit {
  return {
    ...base,
    beds: 20,
    empty: { ...base.empty, value: 6, confirmedAt: NOW },
    allocatable: { ...base.allocatable, value: 6, confirmedAt: NOW },
    // Item 11, owner answer 11 — both units this helper widens (`rgh-adult-secure`,
    // `rph-adult-secure`) are already mostly or wholly locked, so every widened bed is
    // locked-designated: bed KIND, like "no bed", must never be the reason a pull below is
    // refused. `extra` may still override it explicitly where a test wants otherwise.
    allocatableLocked: 6,
    ...extra,
  };
}

// ---------------------------------------------------------------------------------------------
// 1 · High-acuity places are checked when a bed is pulled
// ---------------------------------------------------------------------------------------------

/**
 * Owner ruling 2026-09-10 (`owner-decisions-2026-09-09.md` §5): acuity is a staffing-capacity check,
 * "the same shape as 'is there a bed' and 'is an escort available', and overridable like them".
 * `remainingHighAcuityCapacity` derived the answer and nothing asked it, so a ward staffed for one
 * high-acuity place handed out as many as were pulled.
 */
const ACUITY_UNIT = "rgh-adult-secure";
const ACUTE_A = "WF-HA-A";
const ACUTE_B = "WF-HA-B";
const ORDINARY = "WF-HA-ORD";

function stagedForPull(source: Movement, id: Movement["id"], highAcuity: boolean): Movement {
  return {
    ...source,
    id,
    highAcuity,
    specialling: false,
    stage: "accepted_awaiting_bed",
    acceptedUnitId: ACUITY_UNIT,
    referredUnitIds: [],
    declines: [],
    closure: undefined,
    transport: undefined,
    pullExpiresAt: undefined,
    admissionId: undefined,
  };
}

/**
 * The unit's high-acuity total is SET to one here rather than read from the seed, because one is
 * the interesting number and the seed's authored figure is not this test's subject. Movements are
 * chosen by clinical fit (cohort and security), never by position — see `ward-specialling-capacity.test.ts`.
 */
function acuityBench(): WardFlowState {
  const seeded = seedWardFlowState();
  const base = seeded.units.find((candidate) => candidate.id === ACUITY_UNIT);
  if (!base) throw new Error(`the seed no longer contains unit ${ACUITY_UNIT}`);
  const unit = widened(base, { highAcuityCapacity: 1 });
  const securityWord = unitHasLockedBeds(unit) ? "Secure" : "Open";
  const sources = seeded.movements.filter(
    (candidate) => candidate.cohort === unit.cohort && candidate.security === securityWord,
  );
  if (sources.length < 3) {
    throw new Error(
      `the seed no longer holds three ${securityWord} ${unit.cohort} movements (found ${sources.length})`,
    );
  }
  return {
    ...seeded,
    units: seeded.units.map((candidate) => (candidate.id === ACUITY_UNIT ? unit : candidate)),
    movements: [
      stagedForPull(sources[0], ACUTE_A, true),
      stagedForPull(sources[1], ACUTE_B, true),
      stagedForPull(sources[2], ORDINARY, false),
    ],
    admissions: seeded.admissions.filter((admission) => admission.unitId !== ACUITY_UNIT),
    bedReleases: seeded.bedReleases.filter((release) => release.unitId !== ACUITY_UNIT),
    rejections: [],
  };
}

function pull(
  state: WardFlowState,
  movementId: string,
  unitId: string,
  overrideReason?: string,
  // Item 10, owner answers 17 September 2026: the high-acuity override needs a SECOND fact beside
  // the reason — see tests/ward-acuity-override-num.test.ts for the dedicated reason/tick
  // coverage. Optional and defaulted to absent so every call site below that never passed one
  // keeps exercising "no override offered" exactly as before.
  numConsulted?: true,
): WardFlowState {
  return wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now: NOW,
    movementId,
    unitId,
    overrideReason: overrideReason as (typeof OVERRIDE_REASONS)[number] | undefined,
    numConsulted,
  });
}

describe("PULL_PATIENT checks high-acuity places that are LEFT, not merely authored", () => {
  it("positive control: the first high-acuity patient is pulled and uses the one place", () => {
    const state = acuityBench();
    expect(remainingHighAcuityCapacity(unitIn(state, ACUITY_UNIT), state.admissions)).toBe(1);

    const after = pull(state, ACUTE_A, ACUITY_UNIT);

    expect(after.rejections, "the first high-acuity pull was refused, so nothing below proves anything").toEqual([]);
    expect(movementIn(after, ACUTE_A).stage).toBe("pulled");
    expect(remainingHighAcuityCapacity(unitIn(after, ACUITY_UNIT), after.admissions)).toBe(0);
  });

  it("refuses a second high-acuity patient once the ward's only place is in use, naming the reason", () => {
    const full = pull(acuityBench(), ACUTE_A, ACUITY_UNIT);
    const allocatableBefore = unitIn(full, ACUITY_UNIT).allocatable.value;

    const after = pull(full, ACUTE_B, ACUITY_UNIT);

    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toMatch(/high-acuity/);
    expect(after.rejections[0].reason, "a free bed exists, so the refusal must not claim otherwise").not.toMatch(
      /no allocatable bed/,
    );
    const refused = movementIn(after, ACUTE_B);
    expect(refused.stage).toBe("accepted_awaiting_bed");
    expect(refused.admissionId).toBeUndefined();
    expect(unitIn(after, ACUITY_UNIT).allocatable.value).toBe(allocatableBefore);
  });

  /*
   * ⚠️ **ITEM 10, OWNER ANSWERS 17 SEPTEMBER 2026 — A REASON ALONE NO LONGER ANSWERS THIS
   * REFUSAL.** This test used to pass `OVERRIDE_REASONS[0]` alone and assert success; the owner's
   * ruling requires a SECOND fact — "the nurse unit manager consulted" — before the record is
   * written, so a reason with no tick is now refused. `tests/ward-acuity-override-num.test.ts` is
   * the dedicated file for the full reason/tick combination matrix; this one keeps proving the
   * ORIGINAL property this describe block exists for (a fully-answered override still lets the
   * second high-acuity patient through) with the ruling's extra fact included.
   */
  it("lets a recorded override reason AND the tick answer the refusal, as the owner ruled", () => {
    const full = pull(acuityBench(), ACUTE_A, ACUITY_UNIT);

    const after = pull(full, ACUTE_B, ACUITY_UNIT, OVERRIDE_REASONS[0], true);

    expect(after.rejections).toEqual([]);
    expect(movementIn(after, ACUTE_B).stage).toBe("pulled");
  });

  it("still refuses on a reason alone, with no tick", () => {
    const full = pull(acuityBench(), ACUTE_A, ACUITY_UNIT);

    const after = pull(full, ACUTE_B, ACUITY_UNIT, OVERRIDE_REASONS[0]);

    expect(after.rejections).toHaveLength(1);
    expect(movementIn(after, ACUTE_B).stage).toBe("accepted_awaiting_bed");
  });

  it("does not let an unrecognised string buy past it", () => {
    const full = pull(acuityBench(), ACUTE_A, ACUITY_UNIT);

    const after = pull(full, ACUTE_B, ACUITY_UNIT, "because I said so");

    expect(after.rejections).toHaveLength(1);
    expect(movementIn(after, ACUTE_B).stage).toBe("accepted_awaiting_bed");
  });

  it("leaves a patient who needs no high-acuity place untouched when the places are full", () => {
    const full = pull(acuityBench(), ACUTE_A, ACUITY_UNIT);

    const after = pull(full, ORDINARY, ACUITY_UNIT);

    expect(after.rejections).toEqual([]);
    expect(movementIn(after, ORDINARY).stage).toBe("pulled");
  });
});

// ---------------------------------------------------------------------------------------------
// 2 · A withdrawn referral cannot be accepted
// ---------------------------------------------------------------------------------------------

/**
 * `RECORD_REFERRER_WITHDRAWAL` stamps `withdrawnAt` and deliberately leaves `state` as `queued`
 * (O-17.11: a field, not a fifth state, so each reader opts in). `ACCEPT_REFERRAL` never opted in,
 * so a ward could take a patient whose referrer had already taken the referral back.
 */
function receiveReferral(state: WardFlowState): WardFlowState {
  return wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    ageBand: "Adult",
    destinations: [
      {
        kind: "psychiatric_ward",
        sex: "Female",
        gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
}

function acceptIntoWard(state: WardFlowState, referralId: string): WardFlowState {
  return wardFlowReducer(state, {
    type: "ACCEPT_REFERRAL",
    destinationKind: "psychiatric_ward",
    role: "coordinator",
    now: NOW + 5,
    referralId,
    unitId: "scgh-adult-open",
  });
}

function referralIn(state: WardFlowState, id: string): Referral {
  const found = state.referrals.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing referral ${id}`);
  return found;
}

describe("ACCEPT_REFERRAL refuses a destination the referrer withdrew", () => {
  it("positive control: the same referral, not withdrawn, is accepted", () => {
    const received = receiveReferral(seedWardFlowState());
    expect(received.rejections).toEqual([]);
    const id = received.referrals.at(-1)!.id;

    const after = acceptIntoWard(received, id);

    expect(after.rejections, "the control acceptance was refused, so the refusal below proves nothing").toEqual([]);
    expect(referralIn(after, id).destinations[0].state).toBe("accepted");
  });

  it("refuses the acceptance after a withdrawal and leaves the destination as it was", () => {
    const received = receiveReferral(seedWardFlowState());
    const id = received.referrals.at(-1)!.id;
    const withdrawn = wardFlowReducer(received, {
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: "coordinator",
      now: NOW + 1,
      referralId: id,
    });
    expect(withdrawn.rejections, "the withdrawal itself was refused").toEqual(received.rejections);
    expect(referralIn(withdrawn, id).destinations[0].withdrawnAt).toBe(NOW + 1);

    const after = acceptIntoWard(withdrawn, id);

    expect(after.rejections).toHaveLength(withdrawn.rejections.length + 1);
    expect(after.rejections.at(-1)?.reason).toMatch(/withdr/i);
    const destination = referralIn(after, id).destinations[0];
    expect(destination.state).toBe("queued");
    expect(destination.acceptedUnitId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// 3–5 · A patient stepped back from "pulled" still holds their bed
// ---------------------------------------------------------------------------------------------

/**
 * `STEP_BACK_STAGE` deliberately keeps the bed and `admissionId` (rulings E/F), so a movement
 * stepped back from `pulled` sits at `accepted_awaiting_bed` STILL HOLDING A BED. Three handlers
 * assumed a movement at that stage holds none:
 *
 *   PULL_PATIENT          took a second bed and orphaned the first admission. Owner decision
 *                         2026-09-15: pulling again RESTORES the held pull instead.
 *   WITHDRAW_ACCEPTANCE   cleared the acceptance and left the admission and bed behind. Withdrawing
 *                         while a bed is held is the owner's own open question (ruling 2 of
 *                         2026-09-04), so it is REFUSED, not silently widened into a release.
 *   RECORD_EXAMINATION    a revoked examination gave back only beds at `pulled` or later.
 */
const REPULL_MOVEMENT = "WF-012";
const REPULL_UNIT = "rph-adult-secure";

function pulledWithRoom(): WardFlowState {
  let state = seedWardFlowState();
  state = {
    ...state,
    units: state.units.map((candidate) => (candidate.id === REPULL_UNIT ? widened(candidate) : candidate)),
    bedReleases: state.bedReleases.filter((release) => release.unitId !== REPULL_UNIT),
  };
  for (const step of [
    // T12 (item 9, owner answer 17 September 2026): WF-012 is Non-binary, so referring it needs
    // a reason and a recorded ward check — the fixture predates T12 and never carried either.
    {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      unitIds: [REPULL_UNIT],
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
    },
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: REPULL_UNIT },
    { type: "PULL_PATIENT", role: "ward", unitId: REPULL_UNIT },
  ] as const) {
    state = wardFlowReducer(state, { ...step, now: NOW, movementId: REPULL_MOVEMENT } as never);
  }
  expect(state.rejections, "the fixture's own walk to pulled was refused").toEqual([]);
  expect(movementIn(state, REPULL_MOVEMENT).admissionId).toBeDefined();
  return state;
}

function admissionsAt(state: WardFlowState, unitId: string) {
  return state.admissions.filter((admission) => admission.unitId === unitId);
}

/** Walks the fixture to `pulled`, then steps it back to `accepted_awaiting_bed`, still holding the bed. */
function steppedBackHoldingBed(): WardFlowState {
  const steppedBack = wardFlowReducer(pulledWithRoom(), {
    type: "STEP_BACK_STAGE",
    role: "coordinator",
    now: NOW + 5,
    movementId: REPULL_MOVEMENT,
    to: "accepted_awaiting_bed",
    reason: "the_bed_was_lost",
  });
  expect(steppedBack.rejections, "the step back itself was refused").toEqual([]);
  const movement = movementIn(steppedBack, REPULL_MOVEMENT);
  expect(movement.stage).toBe("accepted_awaiting_bed");
  expect(movement.admissionId, "the premise: a stepped-back movement still holds its admission").toBeDefined();
  return steppedBack;
}

function pullAgain(state: WardFlowState, now = NOW + 10): WardFlowState {
  return wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now,
    movementId: REPULL_MOVEMENT,
    unitId: REPULL_UNIT,
  });
}

describe("PULL_PATIENT on a movement that already holds a bed restores the pull", () => {
  it("returns a stepped-back patient to pulled on the bed they hold, taking no second bed", () => {
    const steppedBack = steppedBackHoldingBed();
    const allocatableBefore = unitIn(steppedBack, REPULL_UNIT).allocatable.value;
    const admissionsBefore = admissionsAt(steppedBack, REPULL_UNIT).length;
    const heldAdmission = movementIn(steppedBack, REPULL_MOVEMENT).admissionId;

    const after = pullAgain(steppedBack);

    expect(after.rejections).toEqual([]);
    const restored = movementIn(after, REPULL_MOVEMENT);
    expect(restored.stage).toBe("pulled");
    expect(restored.admissionId, "the same admission, not a new one").toBe(heldAdmission);
    expect(unitIn(after, REPULL_UNIT).allocatable.value, "no second bed was taken").toBe(allocatableBefore);
    expect(admissionsAt(after, REPULL_UNIT), "no second admission was created").toHaveLength(admissionsBefore);
    expect(restored.stageChanges.at(-1)).toMatchObject({ from: "accepted_awaiting_bed", to: "pulled", at: NOW + 10 });
  });

  /**
   * The discriminator: restoring is keyed on a bed actually being held, not on the movement having
   * been pulled before. Once `RELEASE_PULL` gives the bed back and clears `admissionId`, pulling
   * again is an ordinary pull that takes a bed.
   */
  it("positive control: after the pull is released, pulling again is an ordinary pull that takes a bed", () => {
    const released = wardFlowReducer(pulledWithRoom(), {
      type: "RELEASE_PULL",
      role: "ward",
      now: NOW + 5,
      movementId: REPULL_MOVEMENT,
      actingUnitId: REPULL_UNIT,
      reason: RELEASE_PULL_REASONS[0],
    });
    expect(released.rejections, "the release itself was refused").toEqual([]);
    expect(movementIn(released, REPULL_MOVEMENT).admissionId).toBeUndefined();
    const allocatableBefore = unitIn(released, REPULL_UNIT).allocatable.value;

    const after = pullAgain(released);

    expect(after.rejections).toEqual([]);
    expect(movementIn(after, REPULL_MOVEMENT).stage).toBe("pulled");
    expect(unitIn(after, REPULL_UNIT).allocatable.value).toBe(allocatableBefore - 1);
  });
});

describe("WITHDRAW_ACCEPTANCE refuses while the movement still holds a bed", () => {
  function withdrawAcceptance(state: WardFlowState): WardFlowState {
    return wardFlowReducer(state, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: NOW + 20,
      movementId: REPULL_MOVEMENT,
      reason: "the_bed_was_lost",
    });
  }

  it("refuses, and leaves the acceptance, the admission and the bed exactly as they were", () => {
    const steppedBack = steppedBackHoldingBed();
    const before = movementIn(steppedBack, REPULL_MOVEMENT);
    const allocatableBefore = unitIn(steppedBack, REPULL_UNIT).allocatable.value;

    const after = withdrawAcceptance(steppedBack);

    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toMatch(/still holds a bed/);
    const movement = movementIn(after, REPULL_MOVEMENT);
    expect(movement.acceptedUnitId).toBe(before.acceptedUnitId);
    expect(movement.admissionId).toBe(before.admissionId);
    expect(after.admissions.some((admission) => admission.id === before.admissionId)).toBe(true);
    expect(unitIn(after, REPULL_UNIT).allocatable.value).toBe(allocatableBefore);
  });

  /**
   * The route the refusal names, walked end to end — and the positive control: once the bed is
   * genuinely released, the withdrawal goes through and the ward is left with no phantom occupant.
   */
  it("goes through once the pull is restored and the bed released, leaving no admission behind", () => {
    const steppedBack = steppedBackHoldingBed();
    const heldAdmission = movementIn(steppedBack, REPULL_MOVEMENT).admissionId;
    const restored = pullAgain(steppedBack);
    const released = wardFlowReducer(restored, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: NOW + 15,
      movementId: REPULL_MOVEMENT,
      actingUnitId: REPULL_UNIT,
      reason: RELEASE_PULL_REASONS[0],
    });
    expect(released.rejections, "restore or release was refused").toEqual([]);

    const after = withdrawAcceptance(released);

    expect(after.rejections).toEqual([]);
    const movement = movementIn(after, REPULL_MOVEMENT);
    expect(movement.stage).toBe("destination_review");
    expect(movement.acceptedUnitId).toBeUndefined();
    expect(after.admissions.some((admission) => admission.id === heldAdmission)).toBe(false);
  });
});

describe("a revoked examination gives back a bed held by a stepped-back movement", () => {
  it("returns the bed and removes the admission, closing the movement", () => {
    const steppedBack = steppedBackHoldingBed();
    const heldAdmission = movementIn(steppedBack, REPULL_MOVEMENT).admissionId;
    const allocatableBefore = unitIn(steppedBack, REPULL_UNIT).allocatable.value;

    const after = wardFlowReducer(steppedBack, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 20,
      movementId: REPULL_MOVEMENT,
      outcome: "revoked",
    });

    expect(after.rejections).toEqual([]);
    expect(unitIn(after, REPULL_UNIT).allocatable.value).toBe(allocatableBefore + 1);
    expect(after.admissions.some((admission) => admission.id === heldAdmission)).toBe(false);
    const movement = movementIn(after, REPULL_MOVEMENT);
    expect(movement.admissionId).toBeUndefined();
    expect(movement.closure?.outcome).toBe("did_not_proceed");
  });

  /** Control: a movement that never held a bed gets nothing back — the refund is keyed on a held bed. */
  it("gives nothing back for an accepted movement that never held a bed", () => {
    let accepted = seedWardFlowState();
    accepted = {
      ...accepted,
      units: accepted.units.map((candidate) => (candidate.id === REPULL_UNIT ? widened(candidate) : candidate)),
    };
    for (const step of [
      // T12 (item 9, owner answer 17 September 2026): same non-binary requirement as
      // `pulledWithRoom` above.
      {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        unitIds: [REPULL_UNIT],
        genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
        genderPlacementChecked: true,
      },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: REPULL_UNIT },
    ] as const) {
      accepted = wardFlowReducer(accepted, { ...step, now: NOW, movementId: REPULL_MOVEMENT } as never);
    }
    expect(accepted.rejections).toEqual([]);
    const allocatableBefore = unitIn(accepted, REPULL_UNIT).allocatable.value;

    const after = wardFlowReducer(accepted, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 20,
      movementId: REPULL_MOVEMENT,
      outcome: "revoked",
    });

    expect(after.rejections).toEqual([]);
    expect(unitIn(after, REPULL_UNIT).allocatable.value).toBe(allocatableBefore);
  });
});
