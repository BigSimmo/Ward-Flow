// tests/ward-diagnosis-from-referral.test.ts
import { describe, expect, it } from "vitest";

import { TENTATIVE_DIAGNOSIS_BLOCKS } from "../src/components/ward-management/ward-diagnosis";
import type { Admission } from "../src/components/ward-management/ward-admissions";
import type { ReferralDraft } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Unit } from "../src/components/ward-management/ward-model";
import { allEmergencyDepartments } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * T15 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`, item 12, owner answer 12,
 * 17 September 2026): *"An admission from a referral carries the referral's broad diagnosis
 * category, marked tentative."* And the 29 August ruling behind it: *"easy to continually adjust
 * and refine along the way"* — an ED's own later choice REPLACES what a referral carried, it does
 * not merge with it or get refused because one already exists.
 *
 * Four properties, each a named failing test in the build plan:
 *
 *  1. A referral's `tentativeDiagnosis` survives `RAISE_REFERRAL` onto the movement, then
 *     `PULL_PATIENT` onto the admission, unchanged.
 *  2. The ED's own choice at `RAISE_REFERRAL` REPLACES the referral's value.
 *  3. Nobody recording one at all reaches the admission as `null`, never `undefined` and never a
 *     fabricated default.
 *  4. A code that is not one of `TENTATIVE_DIAGNOSIS_BLOCKS` is refused, membership-checked like
 *     every other closed-list field on `RECEIVE_REFERRAL`.
 */

const ED_ID = allEmergencyDepartments()[0]!.id;
const NOW = 9 * 60;
// Same bench `tests/ward-acuity-override-num.test.ts` already uses: a real Older-Adult/Open unit
// with real allocatable capacity once widened, so a pull always finds a free bed regardless of
// what this file's own diagnosis assertions are about.
const UNIT_ID = "fre-older-adult";

function draft(overrides: Partial<ReferralDraft> = {}): ReferralDraft {
  return {
    cohort: "Older adult",
    security: "Open",
    sex: "Female",
    gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
    specialling: false,
    highAcuity: false,
    legalStatus: "Voluntary",
    urgency: 2,
    legalFormCode: null,
    ...overrides,
  };
}

function raise(state: WardFlowState, overrides: Partial<ReferralDraft> = {}, referralId?: string): WardFlowState {
  return wardFlowReducer(state, {
    type: "RAISE_REFERRAL",
    role: "ed",
    now: NOW,
    edId: ED_ID,
    draft: draft(overrides),
    referralId,
  });
}

/** The one movement `after` holds that `before` did not — by id, never by searching for a
 *  plausible-looking fixture movement (the same discipline `tests/ward-legal-form-due-at-capture
 *  .test.ts` holds to for the identical reason). */
function newestMovement(before: WardFlowState, after: WardFlowState): Movement {
  const created = after.movements.filter(
    (movement) => !before.movements.some((existing) => existing.id === movement.id),
  );
  expect(created, "exactly one movement must have been created by this dispatch").toHaveLength(1);
  return created[0]!;
}

function widenedUnit(base: Unit): Unit {
  return {
    ...base,
    empty: { ...base.empty, value: 4, confirmedAt: NOW },
    allocatable: { ...base.allocatable, value: 4, confirmedAt: NOW },
  };
}

/** Stages `movement` as already accepted at `UNIT_ID` and pulls it — the same direct-state-staging
 *  technique `tests/ward-acuity-override-num.test.ts`'s own `stagedForPull` uses, applied to a
 *  movement THIS file created through the reducer rather than a seeded one. */
function pullThrough(state: WardFlowState, movement: Movement): WardFlowState {
  const seededUnit = state.units.find((candidate) => candidate.id === UNIT_ID);
  if (!seededUnit) throw new Error(`the seed no longer contains unit ${UNIT_ID}`);
  const unit = widenedUnit(seededUnit);
  const staged: Movement = {
    ...movement,
    stage: "accepted_awaiting_bed",
    acceptedUnitId: UNIT_ID,
    referredUnitIds: [],
    declines: [],
    closure: undefined,
    transport: undefined,
    pullExpiresAt: undefined,
    admissionId: undefined,
  };
  const bench: WardFlowState = {
    ...state,
    units: state.units.map((candidate) => (candidate.id === UNIT_ID ? unit : candidate)),
    movements: state.movements.map((candidate) => (candidate.id === movement.id ? staged : candidate)),
    rejections: [],
  };
  return wardFlowReducer(bench, {
    type: "PULL_PATIENT",
    role: "ward",
    now: NOW,
    movementId: movement.id,
    unitId: UNIT_ID,
  });
}

function admissionFor(state: WardFlowState, movementId: string): Admission {
  const movement = state.movements.find((candidate) => candidate.id === movementId);
  expect(movement?.admissionId, "the pull must have created an admission").toBeDefined();
  const admission = state.admissions.find((candidate) => candidate.id === movement!.admissionId);
  expect(admission, "the admission the movement points at must actually exist").toBeDefined();
  return admission!;
}

function receiveReferral(state: WardFlowState, tentativeDiagnosis?: string): WardFlowState {
  return wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW - 30,
    ageBand: "Older adult",
    destinations: [{ kind: "emergency_department", edId: ED_ID, purpose: "bed" }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    tentativeDiagnosis: tentativeDiagnosis as never,
    ...FIXTURE_HISTORY,
  });
}

describe("engine: a referral's tentative diagnosis survives raise and pull unchanged (property 1)", () => {
  it("referral F30–F39 -> raise -> pull -> admission F30–F39", () => {
    const seeded = seedWardFlowState();
    const received = receiveReferral(seeded, "F30–F39");
    expect(received.rejections, "the referral must be accepted, or nothing below is exercised").toEqual([]);
    const referral = received.referrals.at(-1)!;
    expect(referral.tentativeDiagnosis).toBe("F30–F39");

    const raised = raise(received, {}, referral.id);
    expect(raised.rejections, "the journey must be raised, or nothing below is exercised").toEqual([]);
    const movement = newestMovement(received, raised);
    expect(movement.tentativeDiagnosis, "the movement must carry the referral's category unchanged").toBe("F30–F39");

    const pulled = pullThrough(raised, movement);
    expect(pulled.rejections, "the pull must succeed, or the admission assertion below proves nothing").toEqual([]);
    const admission = admissionFor(pulled, movement.id);
    expect(admission.tentativeDiagnosis, "the admission must carry the same category unchanged").toBe("F30–F39");
  });
});

describe("engine: the ED's own choice replaces the referral's (property 2)", () => {
  it("raises with a different category chosen at the ED, and that one wins", () => {
    const seeded = seedWardFlowState();
    const received = receiveReferral(seeded, "F30–F39");
    const referral = received.referrals.at(-1)!;

    const raised = raise(received, { tentativeDiagnosis: "F20–F29" }, referral.id);
    expect(raised.rejections).toEqual([]);
    const movement = newestMovement(received, raised);
    expect(
      movement.tentativeDiagnosis,
      "the ED's own choice must replace the referral's F30–F39, not merge with it or be refused for disagreeing",
    ).toBe("F20–F29");

    const pulled = pullThrough(raised, movement);
    const admission = admissionFor(pulled, movement.id);
    expect(admission.tentativeDiagnosis).toBe("F20–F29");
  });
});

describe("engine: nobody recording one reaches the admission as null, never undefined (property 3)", () => {
  it("raises with no referral and no ED choice -> admission tentativeDiagnosis is null", () => {
    const seeded = seedWardFlowState();
    const raised = raise(seeded, {});
    expect(raised.rejections).toEqual([]);
    const movement = newestMovement(seeded, raised);
    expect(movement.tentativeDiagnosis).toBeUndefined();

    const pulled = pullThrough(raised, movement);
    expect(pulled.rejections).toEqual([]);
    const admission = admissionFor(pulled, movement.id);
    expect(
      admission.tentativeDiagnosis,
      "an admission with no recorded category must be null, Admission's own explicit-absence " +
        "convention — never undefined, which would be a missing field rather than a stated fact",
    ).toBeNull();
  });
});

describe("engine: an unlisted diagnosis code is refused (property 4)", () => {
  it("refuses RECEIVE_REFERRAL when tentativeDiagnosis is not a member of TENTATIVE_DIAGNOSIS_BLOCKS", () => {
    const seeded = seedWardFlowState();
    const after = receiveReferral(seeded, "F00-BOGUS");

    expect(
      after.rejections,
      "an unlisted code must be refused, membership-checked like every other closed field",
    ).toHaveLength(1);
    expect(after.rejections[0]!.reason).toMatch(/tentativeDiagnosis/);
    expect(after.referrals.length, "a refused RECEIVE_REFERRAL must create nothing").toBe(seeded.referrals.length);
  });

  it("anti-vacuity: the bogus code really is absent from the real vocabulary", () => {
    expect(TENTATIVE_DIAGNOSIS_BLOCKS.some((block) => (block.code as string) === "F00-BOGUS")).toBe(false);
    expect(TENTATIVE_DIAGNOSIS_BLOCKS.length).toBeGreaterThan(1);
  });
});
