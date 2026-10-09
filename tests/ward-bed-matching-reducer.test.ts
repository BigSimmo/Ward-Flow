// tests/ward-bed-matching-reducer.test.ts
import { describe, expect, it } from "vitest";

import type { Admission } from "../src/components/ward-management/ward-admissions";
import {
  GENDER_PLACEMENT_REASONS,
  GENDER_PLACEMENT_REFUSAL,
  OVERRIDE_REASONS,
} from "../src/components/ward-management/ward-change-reasons";
import { eligibility, type EligibilityVerdict } from "../src/components/ward-management/ward-eligibility";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, ReferralAddressing, ReferralGender, Sex, Unit } from "../src/components/ward-management/ward-model";
import { referralState } from "../src/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * The bed-matching scenarios of `ward-bed-matching-scenarios.test.ts`, driven through the REDUCER,
 * for the cases where what happens next matters: is the placement refused, can a recorded reason
 * get past it, and is that reason stored. Owner ruling of 25 September 2026 (Josh): beds follow
 * gender identity; a non-binary patient is checked against recorded sex and flagged "coordinator
 * to review".
 *
 * Every refusal is paired with the cisgender twin on the identical ward, so a reducer that refused
 * everybody would fail the twin's half.
 *
 * The wards are this file's own, added beside the seeded ones, because the seeded wards and
 * patients are being rewritten on other branches. Only the seed's frame (sites, configuration,
 * counters) is borrowed.
 */

const NOW = NOW_ANCHOR;
const FLAG = "coordinator to review";
const REASON = OVERRIDE_REASONS[0];
const PLACEMENT_REASON = GENDER_PLACEMENT_REASONS[0];

type Person = { label: string; sex: Sex; gender?: ReferralGender };
const CW: Person = { label: "cis woman", sex: "Female", gender: "Female" };
const CM: Person = { label: "cis man", sex: "Male", gender: "Male" };
const TW: Person = { label: "trans woman (recorded sex male)", sex: "Male", gender: "Female" };
const TM: Person = { label: "trans man (recorded sex female)", sex: "Female", gender: "Male" };
const NBF: Person = { label: "non-binary, recorded sex female", sex: "Female", gender: "Non-binary" };
const NBM: Person = { label: "non-binary, recorded sex male", sex: "Male", gender: "Non-binary" };
const EVERYONE = [CW, CM, TW, TM, NBF, NBM];

/** The ward count a person belongs in under the ruling: gender identity when female or male,
 *  otherwise recorded sex. */
function bucketOf(person: Person): Sex {
  return person.gender === "Female" || person.gender === "Male" ? person.gender : person.sex;
}

/** Mixed ward, one free bed, nine women and no men on it: a woman passes the sex-mix check, a man
 *  does not (scenario ward MX-F). */
const MX_F_ID = "bm-mx-f";

function mxF(): Unit {
  return {
    id: MX_F_ID,
    siteCode: "SCGH",
    name: "Bed-matching MX-F",
    cohort: "Adult",
    lockedBeds: 0,
    authorised: true,
    beds: 10,
    empty: { value: 1, source: "feed", confirmedAt: NOW - 2, staleAfterMinutes: 15 },
    allocatable: { value: 1, source: "ward", confirmedAt: NOW - 5, staleAfterMinutes: 60 },
    allocatableLocked: 0,
    held: 0,
    blocked: 0,
    sexMix: { Female: 9, Male: 0 },
    speciallingCapacity: 1,
    highAcuityCapacity: 1,
    sexDesignation: "Undesignated",
    forensic: false,
  };
}

function awaitingBed(person: Person): Movement {
  return {
    id: "WF-BM-PULL",
    originEdId: "scgh-ed",
    openedAt: NOW - 300,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: person.sex,
    gender: person.gender,
    // A non-binary patient already carries the coordinator's recorded, ward-checked reason for this
    // ward (owner answer OA-9), so the only question left at the pull is the sex-mix check.
    genderPlacements:
      person.gender === "Non-binary"
        ? [{ at: NOW - 60, by: "coordinator", unitIds: [MX_F_ID], reason: PLACEMENT_REASON, wardChecked: true }]
        : undefined,
    specialling: false,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "accepted_awaiting_bed",
    acceptedUnitId: MX_F_ID,
    owner: "Flow coordinator",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  };
}

function bench(movements: Movement[] = []): WardFlowState {
  const seeded = seedWardFlowState();
  return {
    ...seeded,
    units: [...seeded.units, mxF()],
    movements: [...seeded.movements, ...movements],
    rejections: [],
  };
}

function received(person: Person): { state: WardFlowState; referralId: string } {
  const state = wardFlowReducer(bench(), {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    ageBand: "Adult",
    destinations: [
      {
        kind: "psychiatric_ward",
        sex: person.sex,
        gender: person.gender,
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
  expect(state.rejections, `receiving the ${person.label}'s referral`).toEqual([]);
  return { state, referralId: state.referrals.at(-1)!.id };
}

function accept(
  state: WardFlowState,
  referralId: string,
  extra: { overrideReason?: (typeof OVERRIDE_REASONS)[number]; withPlacementRecord?: boolean } = {},
) {
  return wardFlowReducer(state, {
    type: "ACCEPT_REFERRAL",
    destinationKind: "psychiatric_ward",
    role: "coordinator",
    now: NOW,
    referralId,
    unitId: MX_F_ID,
    overrideReason: extra.overrideReason,
    ...(extra.withPlacementRecord ? { genderPlacementReason: PLACEMENT_REASON, genderPlacementChecked: true } : {}),
  });
}

function wardArm(state: WardFlowState, referralId: string): ReferralAddressing {
  const found = state.referrals
    .find((candidate) => candidate.id === referralId)
    ?.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  if (!found) throw new Error(`referral ${referralId} has no psychiatric ward destination`);
  return found;
}

function pull(state: WardFlowState, overrideReason?: (typeof OVERRIDE_REASONS)[number]) {
  return wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now: NOW,
    movementId: "WF-BM-PULL",
    unitId: MX_F_ID,
    overrideReason,
  });
}

function movementIn(state: WardFlowState): Movement {
  const found = state.movements.find((candidate) => candidate.id === "WF-BM-PULL");
  if (!found) throw new Error("state is missing movement WF-BM-PULL");
  return found;
}

describe("referral acceptance on a mixed ward with one free bed and only women on it", () => {
  it("twin: a cis woman is accepted with no reason at all", () => {
    const { state, referralId } = received(CW);
    const after = accept(state, referralId);
    expect(after.rejections).toEqual([]);
    expect(referralState(after.referrals.find((r) => r.id === referralId)!)).toBe("accepted");
  });

  it("BM-08 a non-binary patient recorded female is accepted without an override once the placement is recorded", () => {
    const { state, referralId } = received(NBF);
    const after = accept(state, referralId, { withPlacementRecord: true });
    expect(after.rejections).toEqual([]);
    expect(referralState(after.referrals.find((r) => r.id === referralId)!)).toBe("accepted");
    expect(wardArm(after, referralId).acceptOverrideReason, "nothing was overridden").toBeUndefined();
  });

  it("twin: a cis man is refused on the sex-mix check, which a recorded reason can answer", () => {
    const { state, referralId } = received(CM);
    const refused = accept(state, referralId);
    expect(refused.rejections).toHaveLength(1);
    expect(refused.rejections[0].reason).toContain("sex_mix");
    expect(refused.rejections[0].reason).not.toContain(FLAG);

    const answered = accept(state, referralId, { overrideReason: REASON });
    expect(answered.rejections).toEqual([]);
    expect(wardArm(answered, referralId).acceptOverrideReason).toBe(REASON);
  });

  it("BM-09 a non-binary patient recorded male is refused on the sex-mix check, and the refusal carries the flag", () => {
    const { state, referralId } = received(NBM);
    const refused = accept(state, referralId, { withPlacementRecord: true });
    expect(refused.rejections).toHaveLength(1);
    expect(refused.rejections[0].reason).toContain("sex_mix");
    expect(refused.rejections[0].reason).toContain(FLAG);
    expect(refused.rejections[0].reason).toContain("needs a recorded override reason");
  });

  it("BM-09 the same acceptance goes through with a recorded override reason, and the reason is stored", () => {
    const { state, referralId } = received(NBM);
    const answered = accept(state, referralId, { overrideReason: REASON, withPlacementRecord: true });
    expect(answered.rejections).toEqual([]);
    expect(referralState(answered.referrals.find((r) => r.id === referralId)!)).toBe("accepted");
    expect(wardArm(answered, referralId).acceptOverrideReason).toBe(REASON);
  });

  it("no non-binary acceptance without the coordinator's recorded reason and ward check, even where sex mix passes", () => {
    const { state, referralId } = received(NBF);
    const after = accept(state, referralId);
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toBe(GENDER_PLACEMENT_REFUSAL);
  });
});

describe("pulling a bed on the same ward (movement path)", () => {
  it("twin: a cis woman's bed is pulled with no override recorded", () => {
    const after = pull(bench([awaitingBed(CW)]));
    expect(after.rejections).toEqual([]);
    expect(movementIn(after).stage).toBe("pulled");
    expect(movementIn(after).overrides).toEqual([]);
  });

  it("BM-08 a non-binary patient recorded female is pulled with no override recorded", () => {
    const after = pull(bench([awaitingBed(NBF)]));
    expect(after.rejections).toEqual([]);
    expect(movementIn(after).stage).toBe("pulled");
    expect(movementIn(after).overrides).toEqual([]);
  });

  it("twin: a cis man is refused on the sex-mix check without a reason and pulled with one", () => {
    const refused = pull(bench([awaitingBed(CM)]));
    expect(refused.rejections).toHaveLength(1);
    expect(refused.rejections[0].reason).toContain("failed gate sex_mix");
    expect(refused.rejections[0].reason).not.toContain(FLAG);

    const answered = pull(bench([awaitingBed(CM)]), REASON);
    expect(answered.rejections).toEqual([]);
    expect(movementIn(answered).overrides.map((override) => override.gate)).toEqual(["sex_mix"]);
  });

  it("BM-09 a non-binary patient recorded male is refused with the flag, then pulled with a recorded reason", () => {
    const refused = pull(bench([awaitingBed(NBM)]));
    expect(refused.rejections).toHaveLength(1);
    expect(refused.rejections[0].reason).toContain("failed gate sex_mix");
    expect(refused.rejections[0].reason).toContain(FLAG);
    expect(movementIn(refused).stage).toBe("accepted_awaiting_bed");

    const answered = pull(bench([awaitingBed(NBM)]), REASON);
    expect(answered.rejections).toEqual([]);
    expect(movementIn(answered).stage).toBe("pulled");
    expect(movementIn(answered).overrides).toEqual([
      expect.objectContaining({ gate: "sex_mix", reason: REASON, unitIds: [MX_F_ID] }),
    ]);
  });
});

/** A mixed ward with no free bed and `occupant` among its patients (scenario BM-34). By default
 *  five men and one woman, who is the occupant. */
const FULL_ID = "bm-full";
const OCCUPANT_ADMISSION = "AD-BM-01";

function fullWardWith(occupant: Person, sexMix: Unit["sexMix"] = { Female: 1, Male: 5 }): WardFlowState {
  const base = mxF();
  const unit: Unit = {
    ...base,
    id: FULL_ID,
    name: "Bed-matching full ward",
    empty: { ...base.empty, value: 0 },
    allocatable: { ...base.allocatable, value: 0 },
    sexMix,
  };
  const admission: Admission = {
    id: OCCUPANT_ADMISSION,
    unitId: FULL_ID,
    specialling: false,
    highAcuity: false,
    referralId: null,
    movementId: "WF-BM-ADMITTED",
    patientId: null,
    sex: occupant.sex,
    homeRegion: null,
    tentativeDiagnosis: null,
    bedKind: "open",
    state: "occupied",
    pulledAt: NOW - 700,
    arrivedAt: NOW - 600,
    awayAtEmergencyDepartmentSince: null,
    absentWithoutLeaveSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    followUp: null,
    dischargeBarrier: null,
    stepDownCandidate: false,
  };
  // The movement that admitted the occupant is where their recorded gender lives.
  const admitting: Movement = {
    ...awaitingBed(occupant),
    id: "WF-BM-ADMITTED",
    acceptedUnitId: FULL_ID,
    stage: "arrived",
    admissionId: OCCUPANT_ADMISSION,
    closure: { at: NOW - 600, outcome: "arrived", reason: "Patient arrived at the accepting unit" },
  };
  const seeded = seedWardFlowState();
  return {
    ...seeded,
    units: [...seeded.units, unit],
    movements: [...seeded.movements, admitting],
    admissions: [...seeded.admissions, admission],
    rejections: [],
  };
}

function afterLeaving(occupant: Person, sexMix?: Unit["sexMix"]): Unit {
  const after = wardFlowReducer(fullWardWith(occupant, sexMix), {
    type: "RECORD_LEAVING",
    role: "ward",
    now: NOW,
    admissionId: OCCUPANT_ADMISSION,
    actingUnitId: FULL_ID,
    leavingDestination: "discharged-to-the-community",
  });
  expect(after.rejections, `${occupant.label} leaving`).toEqual([]);
  const unit = after.units.find((candidate) => candidate.id === FULL_ID);
  if (!unit) throw new Error(`state is missing unit ${FULL_ID}`);
  return unit;
}

function sexMixPasses(verdict: EligibilityVerdict) {
  return verdict.gates.find((candidate) => candidate.gate === "sex_mix")?.pass;
}

describe("BM-34 a trans woman leaving a full mixed ward frees the bed exactly as a cis woman leaving does", () => {
  it("the ward's counts come out the same: one bed free, no women, five men", () => {
    const control = afterLeaving(CW);
    const trans = afterLeaving(TW);
    expect(control.sexMix).toEqual({ Female: 0, Male: 5 });
    expect(trans.sexMix).toEqual(control.sexMix);
    expect(trans.allocatable.value).toBe(control.allocatable.value);
  });

  it("the next patients get the same answers after either departure", () => {
    for (const leaver of [CW, TW]) {
      const ward = afterLeaving(leaver);
      expect(sexMixPasses(eligibility(awaitingBed(CW), ward, NOW)), `cis woman after the ${leaver.label} left`).toBe(false);
      expect(sexMixPasses(eligibility(awaitingBed(CM), ward, NOW)), `cis man after the ${leaver.label} left`).toBe(true);
      expect(sexMixPasses(eligibility(awaitingBed(TM), ward, NOW)), `trans man after the ${leaver.label} left`).toBe(true);
    }
  });
});

describe("BM-34 every leaver leaves the count they were counted in", () => {
  it.each(EVERYONE)("$label leaves their gender-identity count, or their recorded-sex count if non-binary", (leaver) => {
    const before: Unit["sexMix"] = { Female: 3, Male: 3 };
    const withLeaver = { ...before, [bucketOf(leaver)]: before[bucketOf(leaver)] + 1 };
    expect(afterLeaving(leaver, withLeaver).sexMix).toEqual(before);
  });
});

/** A movement on the MX-F ward whose bed is pulled, with no transport needed, ready to arrive. */
function readyToArrive(person: Person): WardFlowState {
  return bench([
    { ...awaitingBed(person), stage: "pulled", transportNeed: { needed: false, at: NOW - 10 } },
  ]);
}

describe("arrivals are counted by gender identity, or recorded sex if non-binary", () => {
  it.each(EVERYONE)("$label arriving adds one to their twin's count and nothing to the other", (person) => {
    const before = mxF().sexMix;
    const after = wardFlowReducer(readyToArrive(person), {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW,
      movementId: "WF-BM-PULL",
      actingUnitId: MX_F_ID,
    });
    expect(after.rejections).toEqual([]);
    const unit = after.units.find((candidate) => candidate.id === MX_F_ID);
    const other: Sex = bucketOf(person) === "Female" ? "Male" : "Female";
    expect(unit?.sexMix[bucketOf(person)]).toBe(before[bucketOf(person)] + 1);
    expect(unit?.sexMix[other]).toBe(before[other]);
  });
});
