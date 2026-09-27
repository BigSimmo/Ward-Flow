// tests/ward-bed-kind-pull.test.ts
//
// Item 11, owner answer 11 (17 September 2026): "voluntary patients take open beds first, and
// secure patients take locked beds first." Before this task, `PULL_PATIENT` decremented
// `unit.allocatable` alone and never touched `unit.allocatableLocked`, so `lockedBedsFree` (derived
// from both — `ward-bed-designation.ts`) overstated after every locked-bed pull. No release path
// ever restored a kind, because nothing ever recorded which kind an admission had taken.
//
// `bty-adult-secure` — Bentley Health Service — is the owner's own worked example of a genuinely
// MIXED ward ("Ward 7 in Bentley is a locked/Open ward"), widened here the same way
// `tests/ward-acuity-override-num.test.ts` widens `fre-older-adult`: capacity raised generously so
// a refused pull below is refused on BED KIND, never on plain capacity.

import { describe, expect, it } from "vitest";

import { lockedBedsFree, openBedsFree } from "../src/components/ward-management/ward-bed-designation";
import { OVERRIDE_REASONS, RELEASE_PULL_REASONS } from "../src/components/ward-management/ward-change-reasons";
import { communityTeamOptions } from "../src/components/ward-management/referrals/referral-destination-options";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Unit } from "../src/components/ward-management/ward-model";
import type { Admission } from "../src/components/ward-management/ward-admissions";

const UNIT_ID = "bty-adult-secure";
const PULL_NOW = 11 * 60 + 5;

/**
 * Widened generously beyond the seed's real 2-allocatable/1-locked figures, the same reasoning
 * `ward-acuity-override-num.test.ts`'s own `widenedUnit` states: enough room that a refusal below is
 * refused on the fact under test, never on an incidental shortage.
 *
 * `allocatableLocked: 2` of `allocatable.value: 5` — two locked-designated beds, three open — so a
 * single test can exhaust BOTH locked beds and still have open ones free to fall back onto.
 */
function widenedUnit(base: Unit): Unit {
  return {
    ...base,
    beds: 20,
    lockedBeds: 4,
    empty: { ...base.empty, value: 5, confirmedAt: PULL_NOW },
    allocatable: { ...base.allocatable, value: 5, confirmedAt: PULL_NOW },
    allocatableLocked: 2,
  };
}

/** Mirrors `ward-acuity-override-num.test.ts`'s own `stagedForPull` — duplicated rather than
 *  imported, deliberately, so the two files may diverge without either depending on the other. */
function stagedForPull(source: Movement, id: Movement["id"], overrides: Partial<Movement> = {}): Movement {
  return {
    ...source,
    id,
    highAcuity: false,
    specialling: false,
    stage: "accepted_awaiting_bed",
    acceptedUnitId: UNIT_ID,
    referredUnitIds: [],
    declines: [],
    closure: undefined,
    transport: undefined,
    pullExpiresAt: undefined,
    admissionId: undefined,
    // Isolated from RECORD_EXAMINATION's "already examined" refusal by default — some seeded
    // source movements carry a real examination record, which is irrelevant to bed kind and would
    // collide with the one release-path test that dispatches RECORD_EXAMINATION.
    examination: undefined,
    ...overrides,
  };
}

function bench(): WardFlowState {
  const seeded = seedWardFlowState();
  const base = seeded.units.find((candidate) => candidate.id === UNIT_ID);
  if (!base) throw new Error(`the seed no longer contains unit ${UNIT_ID}`);
  if (base.lockedBeds <= 0) {
    throw new Error(`${UNIT_ID} is no longer a genuinely mixed ward — this file needs both kinds of bed`);
  }
  const unit = widenedUnit(base);

  const secureSources = seeded.movements.filter(
    (candidate) => candidate.cohort === unit.cohort && candidate.security === "Secure",
  );
  const openSources = seeded.movements.filter(
    (candidate) => candidate.cohort === unit.cohort && candidate.security === "Open",
  );
  if (secureSources.length < 4) {
    throw new Error(
      `the seed no longer holds four Secure ${unit.cohort} movements to rewrite (found ${secureSources.length})`,
    );
  }
  if (openSources.length < 1) {
    throw new Error(`the seed no longer holds an Open ${unit.cohort} movement to rewrite`);
  }

  return {
    ...seeded,
    units: seeded.units.map((candidate) => (candidate.id === UNIT_ID ? unit : candidate)),
    movements: [
      stagedForPull(openSources[0], "WF-BK-OPEN"),
      stagedForPull(secureSources[0], "WF-BK-SEC-A"),
      stagedForPull(secureSources[1], "WF-BK-SEC-B"),
      stagedForPull(secureSources[2], "WF-BK-SEC-C"),
      stagedForPull(secureSources[3], "WF-BK-SEC-D"),
    ],
    admissions: seeded.admissions.filter((admission) => admission.unitId !== UNIT_ID),
    bedReleases: seeded.bedReleases.filter((release) => release.unitId !== UNIT_ID),
    rejections: [],
  };
}

function unitIn(state: WardFlowState, id: string = UNIT_ID): Unit {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

function movementIn(state: WardFlowState, id: string): Movement {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function admissionFor(state: WardFlowState, movementId: string): Admission {
  const admissionId = movementIn(state, movementId).admissionId;
  if (!admissionId) throw new Error(`movement ${movementId} holds no admission`);
  const found = state.admissions.find((candidate) => candidate.id === admissionId);
  if (!found) throw new Error(`state is missing admission ${admissionId}`);
  return found;
}

function pull(
  state: WardFlowState,
  movementId: string,
  overrideReason?: (typeof OVERRIDE_REASONS)[number],
): WardFlowState {
  return wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now: PULL_NOW,
    movementId,
    unitId: UNIT_ID,
    overrideReason,
  });
}

describe("PULL_PATIENT decides bed kind from the request's own security (item 11, owner answer 11)", () => {
  it("an Open request at a mixed ward with both kinds free takes an open bed", () => {
    const before = bench();
    const unitBefore = unitIn(before);
    expect(
      lockedBedsFree(unitBefore),
      "the bench must start with a locked bed free, or this proves nothing",
    ).toBeGreaterThan(0);
    expect(
      openBedsFree(unitBefore),
      "the bench must start with an open bed free, or this proves nothing",
    ).toBeGreaterThan(0);

    const pulled = pull(before, "WF-BK-OPEN");
    expect(pulled.rejections).toEqual([]);
    expect(admissionFor(pulled, "WF-BK-OPEN").bedKind).toBe("open");

    const unitAfter = unitIn(pulled);
    expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value - 1);
    // The locked count is UNTOUCHED — an open pull must never move it.
    expect(unitAfter.allocatableLocked).toBe(unitBefore.allocatableLocked);
    expect(lockedBedsFree(unitAfter)).toBe(lockedBedsFree(unitBefore));
    expect(openBedsFree(unitAfter)).toBe(openBedsFree(unitBefore) - 1);
  });

  it("a Secure request takes a locked bed, and lockedBedsFree drops", () => {
    const before = bench();
    const unitBefore = unitIn(before);
    expect(lockedBedsFree(unitBefore)).toBeGreaterThan(0);

    const pulled = pull(before, "WF-BK-SEC-A");
    expect(pulled.rejections).toEqual([]);
    expect(admissionFor(pulled, "WF-BK-SEC-A").bedKind).toBe("locked");

    const unitAfter = unitIn(pulled);
    expect(lockedBedsFree(unitAfter)).toBe(lockedBedsFree(unitBefore) - 1);
    expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value - 1);
    // The open count is UNTOUCHED — a locked pull must never move it.
    expect(openBedsFree(unitAfter)).toBe(openBedsFree(unitBefore));
  });

  it("a Secure request with no locked bed free is refused without a reason, and placed on an open bed with one", () => {
    let state = bench();
    const unitBefore = unitIn(state);
    expect(lockedBedsFree(unitBefore), "the bench must start with exactly two locked beds free").toBe(2);

    // Exhaust both locked beds first, so the third Secure pull below finds none free.
    state = pull(state, "WF-BK-SEC-A");
    expect(state.rejections, "the first exhausting pull must succeed, or this proves nothing").toEqual([]);
    state = pull(state, "WF-BK-SEC-B");
    expect(state.rejections, "the second exhausting pull must succeed, or this proves nothing").toEqual([]);
    expect(lockedBedsFree(unitIn(state)), "both locked beds must now be taken").toBe(0);

    const refused = pull(state, "WF-BK-SEC-C");
    expect(refused.rejections).toHaveLength(1);
    expect(refused.rejections[0].reason).toContain(`No locked bed is free at ${unitBefore.name}`);
    expect(refused.rejections[0].reason).toContain("needs a recorded override reason to use an open bed");
    expect(movementIn(refused, "WF-BK-SEC-C").stage).toBe("accepted_awaiting_bed");
    expect(movementIn(refused, "WF-BK-SEC-C").admissionId).toBeUndefined();

    // An unrecognised string must not buy past the refusal — membership, never truthiness, the same
    // discipline every other override site in this reducer holds to.
    const bogusReason = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: PULL_NOW,
      movementId: "WF-BK-SEC-C",
      unitId: UNIT_ID,
      overrideReason: "Ward manager agreed on the phone" as never,
    });
    expect(bogusReason.rejections).toHaveLength(1);

    const overridden = pull(state, "WF-BK-SEC-C", OVERRIDE_REASONS[0]);
    expect(overridden.rejections, "reason must get the placement through onto an open bed").toEqual([]);
    expect(admissionFor(overridden, "WF-BK-SEC-C").bedKind).toBe("open");
    const unitAfter = unitIn(overridden);
    // Still zero — the placement used an OPEN bed, so the locked count does not move again.
    expect(lockedBedsFree(unitAfter)).toBe(0);
    expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value - 3);
  });
});

describe("every release path restores the bed kind PULL_PATIENT took", () => {
  it("RELEASE_PULL restores a locked bed", () => {
    const before = bench();
    const unitBefore = unitIn(before);
    const pulled = pull(before, "WF-BK-SEC-A");
    expect(pulled.rejections).toEqual([]);
    expect(lockedBedsFree(unitIn(pulled))).toBe(lockedBedsFree(unitBefore) - 1);

    const released = wardFlowReducer(pulled, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: PULL_NOW + 5,
      movementId: "WF-BK-SEC-A",
      reason: RELEASE_PULL_REASONS[0],
    });
    expect(released.rejections).toEqual([]);
    expect(lockedBedsFree(unitIn(released))).toBe(lockedBedsFree(unitBefore));
    expect(unitIn(released).allocatable.value).toBe(unitBefore.allocatable.value);
    expect(released.admissions.some((candidate) => candidate.unitId === UNIT_ID)).toBe(false);
  });

  it("WITHDRAW_REFERRAL restores a locked bed", () => {
    const before = bench();
    const unitBefore = unitIn(before);
    const pulled = pull(before, "WF-BK-SEC-A");
    expect(pulled.rejections).toEqual([]);
    expect(lockedBedsFree(unitIn(pulled))).toBe(lockedBedsFree(unitBefore) - 1);

    const withdrawn = wardFlowReducer(pulled, {
      type: "WITHDRAW_REFERRAL",
      role: "coordinator",
      now: PULL_NOW + 5,
      movementId: "WF-BK-SEC-A",
    });
    expect(withdrawn.rejections).toEqual([]);
    expect(lockedBedsFree(unitIn(withdrawn))).toBe(lockedBedsFree(unitBefore));
    expect(unitIn(withdrawn).allocatable.value).toBe(unitBefore.allocatable.value);
  });

  it("REFER_TO_COMMUNITY_TEAM restores a locked bed", () => {
    const before = bench();
    const unitBefore = unitIn(before);
    const pulled = pull(before, "WF-BK-SEC-A");
    expect(pulled.rejections).toEqual([]);
    expect(lockedBedsFree(unitIn(pulled))).toBe(lockedBedsFree(unitBefore) - 1);

    // F4 (Opus adversarial review, 2026-09-17): WF-BK-SEC-A is on a legal form (a Secure-cohort
    // seed movement), so REFER_TO_COMMUNITY_TEAM now needs a conclusive examination outcome
    // recorded first. `"inpatient_order"` only records and stops — it does not itself release the
    // locked bed — so the release this test proves still belongs to REFER_TO_COMMUNITY_TEAM.
    const examined = wardFlowReducer(pulled, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: PULL_NOW + 4,
      movementId: "WF-BK-SEC-A",
      outcome: "inpatient_order",
    });
    expect(examined.rejections).toEqual([]);

    const team = communityTeamOptions()[0];
    expect(team, "the network must offer at least one community team, or this proves nothing").toBeDefined();
    const referred = wardFlowReducer(examined, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: PULL_NOW + 5,
      movementId: "WF-BK-SEC-A",
      team: team as string,
    });
    expect(referred.rejections).toEqual([]);
    expect(lockedBedsFree(unitIn(referred))).toBe(lockedBedsFree(unitBefore));
    expect(unitIn(referred).allocatable.value).toBe(unitBefore.allocatable.value);
  });

  it("RECORD_EXAMINATION (revoked, at the pulled stage) restores a locked bed", () => {
    const before = bench();
    const unitBefore = unitIn(before);
    const pulled = pull(before, "WF-BK-SEC-A");
    expect(pulled.rejections).toEqual([]);
    expect(lockedBedsFree(unitIn(pulled))).toBe(lockedBedsFree(unitBefore) - 1);

    const examined = wardFlowReducer(pulled, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: PULL_NOW + 5,
      movementId: "WF-BK-SEC-A",
      outcome: "revoked",
    });
    expect(examined.rejections).toEqual([]);
    expect(lockedBedsFree(unitIn(examined))).toBe(lockedBedsFree(unitBefore));
    expect(unitIn(examined).allocatable.value).toBe(unitBefore.allocatable.value);
  });

  /**
   * "Referrer withdrawal" (`RECORD_REFERRER_WITHDRAWAL`) walked through the real event path rather
   * than hand-assembled, the same discipline `ward-audit-engine-fixes-2026-09-16.test.ts`'s own
   * "Fix 5" fixture holds to: a community referral into an emergency department, the department
   * raising a Secure journey off it, then the ordinary REFER_TO_UNITS / ACCEPT_IN_PRINCIPLE /
   * PULL_PATIENT walk onto the widened Bentley unit — proving the front-door referral's own
   * destinations never reach `"accepted"` through that walk (`referralState`, `ward-referrals.ts`),
   * which is what lets `RECORD_REFERRER_WITHDRAWAL` act on it at all.
   */
  it("RECORD_REFERRER_WITHDRAWAL restores a locked bed", () => {
    const seeded = seedWardFlowState();
    const base = seeded.units.find((candidate) => candidate.id === UNIT_ID);
    if (!base) throw new Error(`the seed no longer contains unit ${UNIT_ID}`);
    const unit = widenedUnit(base);
    const state: WardFlowState = {
      ...seeded,
      units: seeded.units.map((candidate) => (candidate.id === UNIT_ID ? unit : candidate)),
      admissions: seeded.admissions.filter((admission) => admission.unitId !== UNIT_ID),
      bedReleases: seeded.bedReleases.filter((release) => release.unitId !== UNIT_ID),
      rejections: [],
    };
    const unitBefore = unitIn(state);

    const referred = wardFlowReducer(state, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: PULL_NOW,
      ageBand: "Adult",
      destinations: [{ kind: "emergency_department", edId: "jhc-ed", purpose: "psychiatric_review" }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      history: "Fixture history for the bed-kind referrer-withdrawal release path.",
    });
    expect(referred.rejections).toEqual([]);
    const referral = referred.referrals.at(-1)!;

    const raised = wardFlowReducer(referred, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: PULL_NOW,
      edId: "jhc-ed",
      referralId: referral.id,
      draft: {
        cohort: unit.cohort,
        security: "Secure",
        sex: "Female",
        gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    expect(raised.rejections).toEqual([]);
    const movementId = raised.movements.at(-1)!.id;
    expect(movementIn(raised, movementId).referralId).toBe(referral.id);

    let next = raised;
    for (const step of [
      { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [UNIT_ID] },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: UNIT_ID },
      { type: "PULL_PATIENT", role: "ward", unitId: UNIT_ID },
    ] as const) {
      next = wardFlowReducer(next, { ...step, now: PULL_NOW, movementId } as never);
    }
    expect(next.rejections, "the fixture's own walk to a pulled bed was refused").toEqual([]);
    expect(admissionFor(next, movementId).bedKind).toBe("locked");
    expect(lockedBedsFree(unitIn(next))).toBe(lockedBedsFree(unitBefore) - 1);

    const withdrawn = wardFlowReducer(next, {
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: "coordinator",
      now: PULL_NOW + 10,
      referralId: referral.id,
    });
    expect(withdrawn.rejections).toEqual([]);
    expect(lockedBedsFree(unitIn(withdrawn))).toBe(lockedBedsFree(unitBefore));
    expect(unitIn(withdrawn).allocatable.value).toBe(unitBefore.allocatable.value);
    expect(movementIn(withdrawn, movementId).admissionId).toBeUndefined();
  });
});

describe("mutation proof: restoring `allocatable` alone is not enough", () => {
  /**
   * States the mutant literally rather than only asserting the property, so a reviewer can see
   * exactly what was reverted: `releasePulledBedAndAdmission` refunding `allocatable.value + 1` and
   * NEVER `allocatableLocked` — this function's own shape before this task. Run by hand against that
   * mutant: `lockedBedsFree` stays at the post-pull, one-short figure forever, which is the live
   * defect item 11 exists to close ("nothing ever reduces the count of free locked beds when one is
   * taken" reads backwards after a release: nothing ever gives it back either).
   */
  it("documents the mutant this suite kills: a release that refunds allocatable but never allocatableLocked", () => {
    const before = bench();
    const unitBefore = unitIn(before);
    const pulled = pull(before, "WF-BK-SEC-A");
    expect(pulled.rejections).toEqual([]);
    const droppedTo = lockedBedsFree(unitIn(pulled));
    expect(droppedTo).toBe(lockedBedsFree(unitBefore) - 1);

    const released = wardFlowReducer(pulled, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: PULL_NOW + 5,
      movementId: "WF-BK-SEC-A",
      reason: RELEASE_PULL_REASONS[0],
    });
    expect(released.rejections).toEqual([]);
    // The real behaviour: fully restored.
    expect(lockedBedsFree(unitIn(released))).toBe(lockedBedsFree(unitBefore));
    // Which is NOT the mutant's figure — an `allocatable`-only refund would leave this at
    // `droppedTo`, one short of the pre-pull count, forever. If a future edit makes this assertion
    // read `droppedTo` instead of `lockedBedsFree(unitBefore)`, the mutant has come back.
    expect(lockedBedsFree(unitIn(released))).not.toBe(droppedTo);
  });
});
