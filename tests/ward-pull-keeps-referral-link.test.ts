// tests/ward-pull-keeps-referral-link.test.ts
//
// R4 (docs/ward-flow/plans/2026-09-16-fix-plan-referral-model.md): `PULL_PATIENT` used to write
// `referralId: null` and `homeRegion: null` on every admission it built, UNCONDITIONALLY — even
// when the movement it pulled from carried a real, resolved `Movement.referralId`.
// `admissionBelongsToTeam` (community/community-derivations.ts) reads exactly that field, so a
// community team's own referred patient became invisible on their team's page at the one moment
// it mattered most: the instant they were pulled to a bed.
//
// ⚠️ WALKS THE REAL FLOW RATHER THAN HAND-BUILDING AN `Admission`, for the same reason
// `ward-movement-referral-link.test.ts` gives for doing the same thing with `Movement.referralId`:
// a hand-built admission with `referralId` set would pass whether or not `PULL_PATIENT` itself
// ever resolves and writes that field. Only objects the reducer produced are asserted on.
import { describe, expect, it } from "vitest";

import {
  admissionBelongsToTeam,
  COMMUNITY_TEAM_PAGES,
} from "../src/components/ward-management/community/community-derivations";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { PatientId } from "../src/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const NOW = NOW_ANCHOR;

/** A real department a community referral can name, matching `ward-movement-referral-link.test.ts`'s own. */
const ED_ID = "jhc-ed";

/** `Adult`, `authorised`, `sexDesignation: "Undesignated"`, `allocatable.value: 2` at `NOW_ANCHOR`
 *  (`ward-sites.ts`) — every eligibility gate the draft below exercises passes trivially, so a
 *  refusal here would be the pipeline, never this unit's own suitability. */
const UNIT_ID = "scgh-adult-open";

/** A real page from the picker's own vocabulary — never an invented team name. */
const TEAM = COMMUNITY_TEAM_PAGES[0];

/**
 * A community team refers somebody BOTH to an emergency department (so the department can later
 * raise a journey the front-door link resolves through, ruling 8) AND, in the SAME act, to a
 * community team (FD-21) — `{emergency_department, community_team}` is the pair
 * `ward-model.ts`'s own destination-union comment names as permitted (the forbidden pair is
 * `{psychiatric_ward, community_team}`). `patientId` travels with it, owner ruling 2026-09-02.
 */
function referToEdAndCommunityTeam(state: WardFlowState, patientId: PatientId): WardFlowState {
  return wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    patientId,
    ageBand: "Adult",
    destinations: [
      { kind: "emergency_department", edId: ED_ID, purpose: "psychiatric_review" },
      { kind: "community_team", teamName: TEAM.name },
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

/** The department raises the journey — `referralId` omitted entirely is what a walk-in looks
 *  like, matching `ward-movement-referral-link.test.ts`'s own `departmentRaisesJourney`. */
function raiseJourney(state: WardFlowState, referralId?: string): WardFlowState {
  return wardFlowReducer(state, {
    type: "RAISE_REFERRAL",
    role: "ed",
    now: NOW,
    edId: ED_ID,
    referralId,
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
      specialling: false,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
}

/** The ordinary walk from a freshly raised movement to a pulled bed: referred, accepted in
 *  principle, pulled — the same three-event sequence `tests/ward-pull-admission-lifecycle.test.ts`
 *  already proves succeeds, run here against a runtime-raised movement instead of a seeded one. */
function pullToBed(state: WardFlowState, movementId: string): WardFlowState {
  const referred = wardFlowReducer(state, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: NOW,
    movementId,
    unitIds: [UNIT_ID],
  });
  const accepted = wardFlowReducer(referred, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: "ward",
    now: NOW,
    movementId,
    unitId: UNIT_ID,
  });
  return wardFlowReducer(accepted, {
    type: "PULL_PATIENT",
    role: "ward",
    now: NOW,
    movementId,
    unitId: UNIT_ID,
  });
}

describe("PULL_PATIENT keeps the referral link its own movement already carries", () => {
  it("admissionBelongsToTeam is true for the referral's own community team once the patient is pulled", () => {
    const referred = referToEdAndCommunityTeam(seedWardFlowState(), "PT-002");
    expect(referred.rejections).toEqual([]);
    const referral = referred.referrals.at(-1)!;

    const raised = raiseJourney(referred, referral.id);
    expect(raised.rejections).toEqual([]);
    const movement = raised.movements.at(-1)!;
    expect(movement.referralId, "the movement must actually resolve the link, or nothing below proves anything").toBe(
      referral.id,
    );

    const pulled = pullToBed(raised, movement.id);
    expect(
      pulled.rejections,
      `a refusal on the walk to a bed proves nothing about the fix: ${pulled.rejections.at(-1)?.reason}`,
    ).toEqual([]);

    const admission = pulled.admissions.at(-1)!;
    expect(
      admission.referralId,
      "the admission must carry the SAME referral id its own movement carries, not the hardcoded " +
        "null this fix replaces",
    ).toBe(referral.id);
    expect(admission.patientId, "patientId must resolve from the same referral, not stay null").toBe(
      referral.patientId,
    );
    expect(admission.homeRegion, "homeRegion must resolve from the same referral, not stay null").toBe(
      referral.homeRegion,
    );

    // THE CLAIM THIS FILE EXISTS TO PROVE: the referral's own community team can see the patient
    // it referred, once that patient is pulled to a bed. Before this fix, `admission.referralId`
    // was `null` here and this returned `false` for every runtime admission without exception.
    expect(
      admissionBelongsToTeam(admission, TEAM, pulled.referrals),
      "the community team named on this referral must see its own referred patient once they are pulled to a bed",
    ).toBe(true);
  });

  /**
   * THE CONTROL. A movement with no linked referral at all (a walk-in) must still honestly write
   * `null` — never a manufactured id, and never the OTHER referral's id merely because one exists
   * elsewhere in state. Without this, the positive test above could pass against a reducer that
   * always sets `referralId` to *some* referral it finds, rather than resolving the one the
   * movement itself names.
   */
  it("a walk-in movement with no referral keeps an honest null, never a manufactured link", () => {
    // A referral exists in state throughout (from `referToEdAndCommunityTeam`), so a fix that
    // grabbed "any" referral rather than resolving THIS movement's own would pass the test above
    // and still be wrong. Proven here by raising a SECOND, referral-less journey at the same
    // department alongside it.
    const referred = referToEdAndCommunityTeam(seedWardFlowState(), "PT-002");
    expect(referred.rejections).toEqual([]);

    const raised = raiseJourney(referred);
    expect(raised.rejections).toEqual([]);
    const movement = raised.movements.at(-1)!;
    expect(movement.referralId, "a walk-in has no referral to link").toBeUndefined();

    const pulled = pullToBed(raised, movement.id);
    expect(
      pulled.rejections,
      `a refusal on the walk to a bed proves nothing about the fix: ${pulled.rejections.at(-1)?.reason}`,
    ).toEqual([]);

    const admission = pulled.admissions.at(-1)!;
    expect(admission.referralId, "no referral resolved, so the admission must honestly say so").toBeNull();
    expect(admission.patientId).toBeNull();
    expect(admission.homeRegion).toBeNull();

    expect(admissionBelongsToTeam(admission, TEAM, pulled.referrals)).toBe(false);
  });
});
