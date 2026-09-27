import { describe, expect, it } from "vitest";

import type { Admission } from "../src/components/ward-management/ward-admissions";
import { remainingHighAcuityCapacity } from "../src/components/ward-management/ward-admissions";
import { wardAdmissions } from "../src/components/ward-management/ward-admissions-seed";
import { unitHasLockedBeds } from "../src/components/ward-management/ward-bed-designation";
import { OVERRIDE_REASONS } from "../src/components/ward-management/ward-change-reasons";
import { eligibility, referralEligibility } from "../src/components/ward-management/ward-eligibility";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import type { Movement, Referral, Unit, WardReferralDestination } from "../src/components/ward-management/ward-model";
import { allUnits } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * The acuity gate, built to the owner's ruling of 2026-09-10: **high-acuity nursing is marked by
 * the REFERRING CLINICIAN at referral**, and the gate is a **staffing-capacity check, never a
 * ranking**. The alternative he was offered and rejected was the system working it out, which
 * would have been the first thing Ward Flow ever did that assessed a patient.
 *
 * ⚠️ **THIS FILE EXISTS BECAUSE A GATE THAT ALWAYS PASSES LOOKS EXACTLY LIKE A GATE THAT WORKS.**
 * Nearly every test below is PAIRED: the same call must come back `false` for one input and `true`
 * for another. A gate wired to a field nothing ever sets, or reading a constant, passes a one-sided
 * suite in full and reports the same green as a working one.
 */

const NOW = 10 * 60 + 42;

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "u-test",
    siteCode: "RPH",
    name: "Test Unit",
    cohort: "Adult",
    lockedBeds: 0,
    authorised: true,
    beds: 20,
    empty: { value: 3, source: "feed", confirmedAt: NOW - 2, staleAfterMinutes: 15 },
    allocatable: { value: 2, source: "ward", confirmedAt: NOW - 10, staleAfterMinutes: 120 },
    allocatableLocked: 0,
    held: 0,
    blocked: 0,
    sexMix: { Female: 10, Male: 8 },
    speciallingCapacity: 1,
    highAcuityCapacity: 1,
    sexDesignation: "Undesignated",
    forensic: false,
    ...overrides,
  };
}

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "WF-001",
    originEdId: "ed-rph",
    openedAt: NOW - 300,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Flow coordinator",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    ...overrides,
  };
}

function wardNeed(overrides: Partial<Omit<WardReferralDestination, "kind">> = {}): WardReferralDestination {
  return {
    kind: "psychiatric_ward",
    sex: "Female",
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    highAcuityNursingNeeded: false,
    ...overrides,
  };
}

function referral(ward: WardReferralDestination): Referral {
  return {
    id: "RF-TEST",
    ageBand: "Adult",
    destinations: [{ destination: ward, state: "queued" }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: NOW - 30,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  };
}

/**
 * ⚠️ **THROWS RATHER THAN RETURNING `undefined` WHEN NO ACUITY GATE IS EMITTED AT ALL.** A gate
 * that is missing and a gate that passes are different states, and `find(...)?.pass !== false`
 * would report them identically — green — which is the exact substitution this whole file is
 * written against.
 */
function acuityGate(verdict: { gates: { gate: string; pass: boolean; detail: string }[] }) {
  const gate = verdict.gates.find((candidate) => candidate.gate === "acuity");
  if (gate === undefined) {
    throw new Error("no acuity gate was emitted at all, which is not the same as one that passes");
  }
  return gate;
}

describe("the acuity gate discriminates, on both paths", () => {
  it("gives a soft advisory pass for a high-acuity movement where the ward staffs none, and passes it where the ward staffs one", () => {
    const needs = movement({ highAcuity: true });
    const gate = acuityGate(eligibility(needs, unit({ highAcuityCapacity: 0 }), NOW));
    expect(gate.pass).toBe(true);
    expect(gate.detail).toContain("additional shift staffing required upon admission");
    expect(acuityGate(eligibility(needs, unit({ highAcuityCapacity: 1 }), NOW)).pass).toBe(true);
  });

  it("passes a movement that does not need it, even where the ward staffs none", () => {
    const gate = acuityGate(eligibility(movement({ highAcuity: false }), unit({ highAcuityCapacity: 0 }), NOW));
    expect(gate.pass).toBe(true);
    expect(gate.detail).toBe("No high-acuity nursing requested for this movement");
  });

  it("gives a soft advisory pass for a high-acuity REFERRAL where the ward staffs none, and passes it where the ward staffs one", () => {
    const need = wardNeed({ highAcuityNursingNeeded: true });
    const ref = referral(need);
    const gate = acuityGate(referralEligibility(ref, need, unit({ highAcuityCapacity: 0 }), NOW));
    expect(gate.pass).toBe(true);
    expect(gate.detail).toContain("additional shift staffing required upon admission");
    expect(acuityGate(referralEligibility(ref, need, unit({ highAcuityCapacity: 1 }), NOW)).pass).toBe(true);
  });

  /*
   * ⚠️ **THE REFERRAL PATH USED TO BE UNABLE TO ANSWER THIS, AND ITS NEIGHBOUR STILL CANNOT.** The
   * `specialling` gate on the same path says "Specialling need is not recorded on a referral", and
   * its own comment ends "if a future referral field ever carries this need, only this gate
   * changes". The owner created exactly that field, for ACUITY, on 2026-09-10. This pins the
   * difference so nobody later tidies the two gates into agreement by making this one stop
   * checking — they are not inconsistent; one reports that nothing was recorded and this one
   * reports what was.
   */
  it("does not fall back to the specialling gate's cannot-answer wording", () => {
    const need = wardNeed({ highAcuityNursingNeeded: true });
    const detail = acuityGate(referralEligibility(referral(need), need, unit({ highAcuityCapacity: 0 }), NOW)).detail;
    expect(detail).not.toMatch(/not recorded on a referral/i);
    expect(detail).toContain("High-acuity nursing requested");
  });

  it("is not a ranking: two movements differing only in urgency get the identical verdict", () => {
    const ward = unit({ highAcuityCapacity: 1 });
    const tier1 = acuityGate(eligibility(movement({ highAcuity: true, urgency: 1 }), ward, NOW));
    const tier3 = acuityGate(eligibility(movement({ highAcuity: true, urgency: 3 }), ward, NOW));
    expect(tier1).toEqual(tier3);
  });
});

describe("the gate never claims headroom it cannot see", () => {
  /*
   * The closed specialling defect, one file along: a screen printed "N available" from the ward's
   * AUTHORED total, `PULL_PATIENT` then refused the placement, and the screen had invited the
   * placement the engine rejects. `eligibility()` is handed no admissions, so it cannot know what
   * is LEFT — and `command-third-edition.html` prints exactly the subtraction this refuses to.
   */
  /*
   * ⚠️ **THIS GUARD REDDENED ON MY OWN FIRST WORDING AND THE SENTENCE WAS CHANGED, NOT THE GUARD.**
   * The detail read "— whether one is free is decided at the pull", which used "free" to say the
   * gate does NOT know. Honest, and it still had to go: a guard relaxed to admit the one phrasing
   * its author happened to like stops being able to catch the phrasing that matters. The banned
   * words are cheap to avoid and the count they would introduce is not.
   */
  it("states the staffed total and never a remaining count", () => {
    const gate = acuityGate(eligibility(movement({ highAcuity: true }), unit({ highAcuityCapacity: 3 }), NOW));
    expect(gate.detail).toContain("staffed for 3 high-acuity places");
    expect(gate.detail).not.toMatch(/\bin use\b|\bavailable\b|\bfree\b|\bremaining\b|\bleft\b/i);
  });

  it("says place for one and places for more than one", () => {
    const one = acuityGate(eligibility(movement({ highAcuity: true }), unit({ highAcuityCapacity: 1 }), NOW)).detail;
    const two = acuityGate(eligibility(movement({ highAcuity: true }), unit({ highAcuityCapacity: 2 }), NOW)).detail;
    expect(one).toContain("1 high-acuity place.");
    expect(two).toContain("2 high-acuity places.");
  });
});

describe("remainingHighAcuityCapacity is the only thing that knows what is left", () => {
  /** Built from a REAL seeded admission rather than a cast, so a field added to `Admission`
   *  arrives here already populated instead of being silently absent behind an `as`. */
  const seed = wardAdmissions[0];

  function admission(overrides: Partial<Admission> = {}): Admission {
    return { ...seed, id: "AD-TEST", unitId: "u-test", state: "occupied", highAcuity: true, ...overrides };
  }

  it("decrements as high-acuity places fill, where the authored figure does not", () => {
    const ward = unit({ highAcuityCapacity: 2 });
    expect(remainingHighAcuityCapacity(ward, [])).toBe(2);
    expect(remainingHighAcuityCapacity(ward, [admission()])).toBe(1);
    expect(remainingHighAcuityCapacity(ward, [admission(), admission({ id: "AD-TEST-2" })])).toBe(0);
    // Unmoved throughout, which is the entire reason this function exists.
    expect(ward.highAcuityCapacity).toBe(2);
  });

  it("does not count an occupied bed that is not a high-acuity place", () => {
    expect(remainingHighAcuityCapacity(unit({ highAcuityCapacity: 2 }), [admission({ highAcuity: false })])).toBe(2);
  });

  it("does not count another ward's admissions", () => {
    expect(remainingHighAcuityCapacity(unit({ highAcuityCapacity: 2 }), [admission({ unitId: "elsewhere" })])).toBe(2);
  });

  it("degrades to zero places rather than an unbounded ward on an incoherent figure", () => {
    expect(remainingHighAcuityCapacity(unit({ highAcuityCapacity: Number.NaN }), [])).toBe(0);
    expect(remainingHighAcuityCapacity(unit({ highAcuityCapacity: -4 }), [])).toBe(0);
  });
});

/**
 * ⚠️ **THE SEED IS PART OF THE GATE.** A gate wired correctly to a field that every shipped ward
 * and every shipped movement answers the same way is untestable by inspection and green forever.
 * These fail the moment the data stops exercising both branches — a state the gate would otherwise
 * reach in silence.
 */
describe("the shipped data exercises both branches", () => {
  it("ships wards that staff high-acuity places and wards that staff none", () => {
    const units = allUnits();
    const staffing = units.filter((candidate) => candidate.highAcuityCapacity > 0).length;
    expect(staffing).toBeGreaterThan(0);
    expect(staffing).toBeLessThan(units.length);
  });

  it("ships movements that need high-acuity nursing and movements that do not", () => {
    const needing = wardMovements.filter((candidate) => candidate.highAcuity).length;
    expect(needing).toBeGreaterThan(0);
    expect(needing).toBeLessThan(wardMovements.length);
  });

  it("does not make high acuity a synonym for specialling in the seed", () => {
    const acuityOnly = wardMovements.filter((one) => one.highAcuity && !one.specialling).length;
    const speciallingOnly = wardMovements.filter((one) => !one.highAcuity && one.specialling).length;
    // If either field were derived from the other, one of these two is zero.
    expect(acuityOnly).toBeGreaterThan(0);
    expect(speciallingOnly).toBeGreaterThan(0);
  });
});

/**
 * `eligibility()`'s acuity gate above renders a verdict; rendering a verdict does not stop a
 * transition. Owner ruling (2026-09-10, `docs/ward-flow/owner-decisions-2026-09-09.md` §5): acuity
 * is a staffing-capacity check, "overridable like them" — mirroring `remainingSpeciallingCapacity`'s
 * enforcement in `PULL_PATIENT`, exactly the pattern proven in `tests/ward-specialling-capacity.test.ts`.
 * These tests drive the REDUCER, not the gate, because that is the only place the property that
 * matters — the state transition cannot happen — can be proven.
 */
describe("high-acuity staffing capacity — the pull", () => {
  const UNIT_ID = "fre-older-adult";
  const ACUITY_A = "WF-HA-A";
  const ACUITY_B = "WF-HA-B";
  const ORDINARY_HA = "WF-HA-ORD";
  const PULL_NOW = 10 * 60 + 42;

  function widenedUnit(base: Unit): Unit {
    return {
      ...base,
      beds: 20,
      empty: { ...base.empty, value: 6, confirmedAt: PULL_NOW },
      allocatable: { ...base.allocatable, value: 6, confirmedAt: PULL_NOW },
    };
  }

  function stagedForPull(source: Movement, id: Movement["id"], highAcuity: boolean): Movement {
    return {
      ...source,
      id,
      highAcuity,
      // Isolated from the specialling gate deliberately: this file tests acuity capacity alone, and
      // `fre-older-adult` staffs only 1 specialling place too, so an inherited `specialling: true`
      // from the seeded source movement would collide with a different capacity check entirely.
      specialling: false,
      stage: "accepted_awaiting_bed",
      acceptedUnitId: UNIT_ID,
      referredUnitIds: [],
      declines: [],
      closure: undefined,
      transport: undefined,
      pullExpiresAt: undefined,
      admissionId: undefined,
    };
  }

  function bench(): WardFlowState {
    const seeded = seedWardFlowState();
    const base = seeded.units.find((candidate) => candidate.id === UNIT_ID);
    if (!base) throw new Error(`the seed no longer contains unit ${UNIT_ID}`);
    if (base.highAcuityCapacity !== 1) {
      throw new Error(`${UNIT_ID} is authored with ${base.highAcuityCapacity} high-acuity capacity, not 1`);
    }

    const unit = widenedUnit(base);
    const unitSecurityWord = unitHasLockedBeds(unit) ? "Secure" : "Open";
    const sources = seeded.movements.filter(
      (candidate) => candidate.cohort === unit.cohort && candidate.security === unitSecurityWord,
    );
    if (sources.length < 3) {
      throw new Error(
        `the seed no longer holds three ${unitSecurityWord} ${unit.cohort} movements to rewrite ` +
          `(found ${sources.length}) — this file must not fall back to a clinically wrong placement`,
      );
    }

    return {
      ...seeded,
      units: seeded.units.map((candidate) => (candidate.id === UNIT_ID ? unit : candidate)),
      movements: [
        stagedForPull(sources[0], ACUITY_A, true),
        stagedForPull(sources[1], ACUITY_B, true),
        stagedForPull(sources[2], ORDINARY_HA, false),
      ],
      admissions: seeded.admissions.filter((admission) => admission.unitId !== UNIT_ID),
      bedReleases: seeded.bedReleases.filter((release) => release.unitId !== UNIT_ID),
      rejections: [],
    };
  }

  function unitIn(state: WardFlowState): Unit {
    const found = state.units.find((candidate) => candidate.id === UNIT_ID);
    if (!found) throw new Error(`state is missing unit ${UNIT_ID}`);
    return found;
  }

  function movementIn(state: WardFlowState, id: string): Movement {
    const found = state.movements.find((candidate) => candidate.id === id);
    if (!found) throw new Error(`state is missing movement ${id}`);
    return found;
  }

  function occupantsOf(state: WardFlowState): Admission[] {
    return state.admissions.filter((admission) => admission.unitId === UNIT_ID);
  }

  function pull(
    state: WardFlowState,
    movementId: string,
    overrideReason?: (typeof OVERRIDE_REASONS)[number],
    // Item 10, owner answers 17 September 2026: the high-acuity staffing override needs a SECOND
    // fact beside the reason — see tests/ward-acuity-override-num.test.ts for the dedicated
    // reason/tick coverage. Optional and defaulted to absent so every call site below that never
    // passed one keeps exercising "no override offered" exactly as before.
    numConsulted?: true,
  ): WardFlowState {
    return wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: PULL_NOW,
      movementId,
      unitId: UNIT_ID,
      overrideReason,
      numConsulted,
    });
  }

  it("lets the first high-acuity patient in, then refuses a second without an override reason", () => {
    const first = pull(bench(), ACUITY_A);
    // Control: with one high-acuity place still free, the pull is permitted — proving any later
    // refusal in this block comes from staffing running out, not from this fixture being unpullable.
    expect(first.rejections, "the first pull must succeed, or every test below proves nothing").toEqual([]);
    expect(movementIn(first, ACUITY_A).stage).toBe("pulled");
    expect(occupantsOf(first)).toHaveLength(1);
    expect(occupantsOf(first)[0].highAcuity, "the pull must record the ward's high-acuity commitment").toBe(true);
    expect(remainingHighAcuityCapacity(unitIn(first), first.admissions)).toBe(0);

    const second = pull(first, ACUITY_B);
    expect(second.rejections).toHaveLength(1);
    const reason = second.rejections[0].reason;
    expect(reason, "the refusal must name the constraint that actually applies").toMatch(/high-acuity/i);
    expect(reason, "the ward has six allocatable beds, so 'no bed' would be untrue").not.toMatch(/allocatable bed/i);

    // Refused means refused: no stage change, and no second person in a bed.
    expect(movementIn(second, ACUITY_B).stage).toBe("accepted_awaiting_bed");
    expect(movementIn(second, ACUITY_B).admissionId).toBeUndefined();
    expect(occupantsOf(second)).toHaveLength(1);
  });

  /*
   * ⚠️ **THIS USED TO PIN A ONE-FIELD OVERRIDE, AND THE OWNER'S 17 SEPTEMBER RULING (ITEM 10)
   * CLOSED IT.** A reason alone used to get the placement through; it no longer does, because the
   * ruling requires a SECOND fact — "the nurse unit manager consulted" — before the record is
   * written. `tests/ward-acuity-override-num.test.ts` is the dedicated file for the reason/tick
   * combinations; this one keeps proving the ORIGINAL property this file exists for (capacity
   * exhaustion still stops an unanswered pull, and a fully-answered override still lets one
   * through) rather than silently keeping the superseded one-field shape.
   */
  it("still refuses the second high-acuity patient on a reason alone, with no tick", () => {
    const reason = OVERRIDE_REASONS[0];
    const first = pull(bench(), ACUITY_A);
    const second = pull(first, ACUITY_B, reason);

    expect(second.rejections, "a reason with no tick must not get the placement through").toHaveLength(1);
    expect(movementIn(second, ACUITY_B).stage).toBe("accepted_awaiting_bed");
  });

  it("lets the second high-acuity patient through with a recorded override reason AND the tick", () => {
    const reason = OVERRIDE_REASONS[0];
    const first = pull(bench(), ACUITY_A);
    const second = pull(first, ACUITY_B, reason, true);

    expect(second.rejections, "a recorded override reason and tick must get the placement through").toEqual([]);
    expect(movementIn(second, ACUITY_B).stage).toBe("pulled");
    expect(occupantsOf(second)).toHaveLength(2);
    expect(occupantsOf(second).filter((admission) => admission.highAcuity)).toHaveLength(2);
  });

  it("still lets a non-high-acuity patient into the same ward once acuity capacity is exhausted", () => {
    const first = pull(bench(), ACUITY_A);
    const ordinary = pull(first, ORDINARY_HA);

    expect(ordinary.rejections, "a patient who does not need high-acuity nursing is unaffected").toEqual([]);
    expect(movementIn(ordinary, ORDINARY_HA).stage).toBe("pulled");
    expect(occupantsOf(ordinary)).toHaveLength(2);
    expect(occupantsOf(ordinary).filter((admission) => admission.highAcuity)).toHaveLength(1);

    // And the ward is still full for high-acuity: an ordinary occupant consumes no high-acuity place.
    expect(remainingHighAcuityCapacity(unitIn(ordinary), ordinary.admissions)).toBe(0);
  });
});
