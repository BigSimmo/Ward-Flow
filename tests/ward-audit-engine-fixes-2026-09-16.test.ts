// tests/ward-audit-engine-fixes-2026-09-16.test.ts
//
// Catchers for the nine defects named in the 2026-09-16 ward-flow-reducer audit brief, each
// verified failing against the reducer at commit f44ae7369d before its own fix landed. One
// `describe` per numbered fix; the numbering below matches the brief exactly.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { TRANSPORT_PROVIDERS } from "../src/components/ward-management/ward-model";
import {
  CANCEL_TRANSPORT_REASONS,
  GENDER_PLACEMENT_REASONS,
} from "../src/components/ward-management/ward-change-reasons";
import { communityTeamOptions } from "../src/components/ward-management/referrals/referral-destination-options";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const NOW = NOW_ANCHOR;

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function unit(state: WardFlowState, id: string) {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

// -------------------------------------------------------------------------------------------
// Shared fixture: a movement genuinely pulled to a bed at a unit with real room, walked through
// the real event path (never hand-assembled) — the same pattern `tests/ward-engine-defects.test.ts`
// uses for its own REPULL fixture. `rph-adult-secure` is widened so capacity and pending-release
// checks cannot make the setup walk itself flaky, and WF-012 is the same movement already proven
// to pass this unit's eligibility gates with no override needed.
// -------------------------------------------------------------------------------------------
const CAPACITY_UNIT = "rph-adult-secure";
const CAPACITY_MOVEMENT = "WF-012";

function withRoom(state: WardFlowState, unitId: string): WardFlowState {
  return {
    ...state,
    units: state.units.map((candidate) =>
      candidate.id === unitId
        ? {
            ...candidate,
            beds: 20,
            empty: { ...candidate.empty, value: 6, confirmedAt: NOW },
            allocatable: { ...candidate.allocatable, value: 6, confirmedAt: NOW },
          }
        : candidate,
    ),
    bedReleases: state.bedReleases.filter((release) => release.unitId !== unitId),
  };
}

function pulledMovement(movementId = CAPACITY_MOVEMENT, unitId = CAPACITY_UNIT) {
  let state = withRoom(seedWardFlowState(), unitId);
  for (const step of [
    // T12 (item 9, owner answer 17 September 2026): WF-012 is Non-binary, so referring it needs
    // a reason and a recorded ward check — the fixture predates T12 and never carried either.
    {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      unitIds: [unitId],
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
    },
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId },
    { type: "PULL_PATIENT", role: "ward", unitId },
  ] as const) {
    state = wardFlowReducer(state, { ...step, now: NOW, movementId } as never);
  }
  expect(state.rejections, "the fixture's own walk to pulled was refused").toEqual([]);
  expect(movement(state, movementId).admissionId, "the walk must have created an admission").toBeDefined();
  return { state, movementId, unitId };
}

describe("Fix 1: no dead duplicate switch cases", () => {
  it("has RECORD_LEGAL_FORM_RECEIVED and REFER_TO_COMMUNITY_TEAM as switch cases exactly once each", () => {
    const text = source("src/components/ward-management/ward-flow-reducer.ts");
    const countOf = (eventType: string) => (text.match(new RegExp(`case "${eventType}":`, "g")) ?? []).length;
    // The floor: the strings must actually be found at all, or a rename would make both counts
    // zero and this test would pass for the wrong reason.
    expect(text).toContain('case "RECORD_LEGAL_FORM_RECEIVED":');
    expect(text).toContain('case "REFER_TO_COMMUNITY_TEAM":');
    expect(countOf("RECORD_LEGAL_FORM_RECEIVED")).toBe(1);
    expect(countOf("REFER_TO_COMMUNITY_TEAM")).toBe(1);
  });
});

describe("Fix 2: a bed held after STEP_BACK_STAGE is refunded, not leaked", () => {
  it("PULL_PATIENT -> STEP_BACK_STAGE (accepted_awaiting_bed) -> WITHDRAW_REFERRAL refunds the bed and deletes the admission", () => {
    const { state: pulled, movementId, unitId } = pulledMovement();
    const unitBefore = unit(pulled, unitId);
    const admissionId = movement(pulled, movementId).admissionId!;

    const steppedBack = wardFlowReducer(pulled, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: NOW + 1,
      movementId,
      to: "accepted_awaiting_bed",
      reason: "recorded_in_error",
    });
    expect(steppedBack.rejections).toEqual([]);
    const stepped = movement(steppedBack, movementId);
    expect(stepped.stage).toBe("accepted_awaiting_bed");
    // Rulings E/F: STEP_BACK_STAGE keeps the bed and the admission — this is the state the leak
    // depends on existing.
    expect(stepped.admissionId).toBe(admissionId);

    const withdrawn = wardFlowReducer(steppedBack, {
      type: "WITHDRAW_REFERRAL",
      role: "coordinator",
      now: NOW + 2,
      movementId,
    });
    expect(withdrawn.rejections).toEqual([]);
    expect(unit(withdrawn, unitId).allocatable.value).toBe(unitBefore.allocatable.value + 1);
    expect(movement(withdrawn, movementId).admissionId).toBeUndefined();
    expect(withdrawn.admissions.some((candidate) => candidate.id === admissionId)).toBe(false);
  });

  it("PULL_PATIENT -> STEP_BACK_STAGE (accepted_awaiting_bed) -> REFER_TO_COMMUNITY_TEAM refunds the bed and deletes the admission", () => {
    const { state: pulled, movementId, unitId } = pulledMovement();
    const unitBefore = unit(pulled, unitId);
    const admissionId = movement(pulled, movementId).admissionId!;

    const steppedBack = wardFlowReducer(pulled, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: NOW + 1,
      movementId,
      to: "accepted_awaiting_bed",
      reason: "recorded_in_error",
    });
    expect(steppedBack.rejections).toEqual([]);
    expect(movement(steppedBack, movementId).admissionId).toBe(admissionId);

    // F4 (Opus adversarial review, 2026-09-17): WF-012 carries a 1A legal form, so
    // REFER_TO_COMMUNITY_TEAM now needs a conclusive examination outcome recorded first.
    // `"inpatient_order"` only records and stops — it does not itself release the bed being
    // pulled here — so the release this test proves still belongs to REFER_TO_COMMUNITY_TEAM.
    const examined = wardFlowReducer(steppedBack, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId,
      outcome: "inpatient_order",
    });
    expect(examined.rejections).toEqual([]);

    const team = communityTeamOptions()[0];
    const referred = wardFlowReducer(examined, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW + 2,
      movementId,
      team,
    });
    expect(referred.rejections).toEqual([]);
    expect(unit(referred, unitId).allocatable.value).toBe(unitBefore.allocatable.value + 1);
    expect(movement(referred, movementId).admissionId).toBeUndefined();
    expect(referred.admissions.some((candidate) => candidate.id === admissionId)).toBe(false);
  });

  it("does not double-refund a movement that is still at pulled (the ordinary, already-working path)", () => {
    const { state: pulled, movementId, unitId } = pulledMovement();
    const unitBefore = unit(pulled, unitId);

    const withdrawn = wardFlowReducer(pulled, {
      type: "WITHDRAW_REFERRAL",
      role: "coordinator",
      now: NOW + 1,
      movementId,
    });
    expect(withdrawn.rejections).toEqual([]);
    // Exactly one bed back, never two — the widened OR condition must not fire twice for a
    // movement that already satisfied the original `stage === "pulled"` half on its own.
    expect(unit(withdrawn, unitId).allocatable.value).toBe(unitBefore.allocatable.value + 1);
  });
});

describe("Fix 3: REFER_TO_COMMUNITY_TEAM refuses a collected movement", () => {
  function collectedMovement() {
    const { state: pulled, movementId, unitId } = pulledMovement();
    const booked = wardFlowReducer(pulled, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW + 1,
      movementId,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: false,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    const ready = wardFlowReducer(booked, { type: "HANDOVER_READY", role: "ed", now: NOW + 2, movementId });
    const accepted = wardFlowReducer(ready, { type: "TRANSPORT_ACCEPTED", role: "officer", now: NOW + 3, movementId });
    const enRoute = wardFlowReducer(accepted, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW + 4,
      movementId,
    });
    const collected = wardFlowReducer(enRoute, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      now: NOW + 5,
      movementId,
    });
    expect(collected.rejections, "the setup walk to collected must be accepted in full").toEqual([]);
    expect(movement(collected, movementId).transport?.collectedAt).toBeDefined();
    return { state: collected, movementId, unitId };
  }

  it("rejects REFER_TO_COMMUNITY_TEAM once the patient has been collected, leaving state unchanged", () => {
    const { state: collected, movementId } = collectedMovement();
    const team = communityTeamOptions()[0];
    const attempt = wardFlowReducer(collected, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW + 6,
      movementId,
      team,
    });
    expect(attempt.rejections.length).toBeGreaterThan(0);
    expect(attempt.rejections[0].reason).toContain("STOP_TRANSPORT");
    // Visibly refused AND unchanged.
    expect(attempt.movements).toEqual(collected.movements);
    expect(attempt.units).toEqual(collected.units);
    expect(attempt.admissions).toEqual(collected.admissions);
  });
});

describe("Fix 4: REFER_TO_COMMUNITY_TEAM unwinds a held bed and a booked, uncollected transport together", () => {
  it("refunds the bed once, deletes the admission, cancels the transport, and closes the movement did_not_proceed", () => {
    const { state: pulled, movementId, unitId } = pulledMovement();
    const unitBefore = unit(pulled, unitId);
    const admissionId = movement(pulled, movementId).admissionId!;

    const booked = wardFlowReducer(pulled, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW + 1,
      movementId,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: false,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    expect(booked.rejections).toEqual([]);
    const bookedTransportId = movement(booked, movementId).transport?.id;
    expect(bookedTransportId).toBeDefined();
    expect(movement(booked, movementId).transport?.collectedAt).toBeUndefined();

    // F4 (Opus adversarial review, 2026-09-17): same conclusive-examination requirement as the
    // Fix 2 test above — WF-012's 1A form now blocks REFER_TO_COMMUNITY_TEAM without it.
    const examined = wardFlowReducer(booked, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 1,
      movementId,
      outcome: "inpatient_order",
    });
    expect(examined.rejections).toEqual([]);

    const team = communityTeamOptions()[0];
    const referred = wardFlowReducer(examined, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW + 2,
      movementId,
      team,
    });
    expect(referred.rejections).toEqual([]);

    expect(unit(referred, unitId).allocatable.value).toBe(unitBefore.allocatable.value + 1);
    const closedMovement = movement(referred, movementId);
    expect(closedMovement.admissionId).toBeUndefined();
    expect(referred.admissions.some((candidate) => candidate.id === admissionId)).toBe(false);
    expect(closedMovement.transport?.id).toBe(bookedTransportId);
    expect(closedMovement.transport?.cancelledAt).toBe(NOW + 2);
    expect(closedMovement.closure?.outcome).toBe("did_not_proceed");
  });
});

describe("Fix 5: RECORD_REFERRER_WITHDRAWAL cascades to every linked open movement", () => {
  const ATTENDED_ED = "jhc-ed";

  function communityRefersToEmergencyDepartment(state: WardFlowState) {
    return wardFlowReducer(state, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW,
      ageBand: "Adult",
      destinations: [{ kind: "emergency_department", edId: ATTENDED_ED, purpose: "psychiatric_review" }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
  }

  function departmentRaisesJourney(state: WardFlowState, referralId: string) {
    return wardFlowReducer(state, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: ATTENDED_ED,
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

  /**
   * The full brief scenario: RECEIVE_REFERRAL to an ED, RAISE_REFERRAL with that referralId,
   * REFER_TO_UNITS, ACCEPT_IN_PRINCIPLE, PULL_PATIENT, BOOK_TRANSPORT — a movement raised from a
   * referral, walked all the way to a held bed and a booked, uncollected transport job, entirely
   * through the real event path. `overrideReason` is supplied on the two eligibility-gated steps
   * so this fixture is about the cascade, not about matching a particular unit's suitability gate.
   */
  function referredMovementHoldingBedAndTransport(unitId = CAPACITY_UNIT) {
    const state = withRoom(seedWardFlowState(), unitId);
    const referred = communityRefersToEmergencyDepartment(state);
    expect(referred.rejections).toEqual([]);
    const referral = referred.referrals.at(-1)!;

    const raised = departmentRaisesJourney(referred, referral.id);
    expect(raised.rejections).toEqual([]);
    const movementId = raised.movements.at(-1)!.id;
    expect(movement(raised, movementId).referralId).toBe(referral.id);

    let next = raised;
    for (const step of [
      {
        type: "REFER_TO_UNITS",
        role: "coordinator",
        unitIds: [unitId],
        overrideReason: "The bed information is known to be out of date",
      },
      {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        unitId,
        overrideReason: "The bed information is known to be out of date",
      },
      { type: "PULL_PATIENT", role: "ward", unitId },
      {
        type: "BOOK_TRANSPORT",
        role: "ed",
        provider: TRANSPORT_PROVIDERS[0],
        escortRequired: false,
        cadNumber: "CAD-STUB-0001",
        transportLegalStatus: "voluntary",
        estimatedAt: 0,
      },
    ] as const) {
      next = wardFlowReducer(next, { ...step, now: NOW, movementId } as never);
    }
    expect(next.rejections, "the fixture's own walk to a booked transport was refused").toEqual([]);
    expect(movement(next, movementId).admissionId).toBeDefined();
    expect(movement(next, movementId).transport?.collectedAt).toBeUndefined();
    return { state: next, movementId, referralId: referral.id, unitId };
  }

  it("refunds the bed, deletes the admission, cancels the transport and closes the movement", () => {
    const { state, movementId, referralId, unitId } = referredMovementHoldingBedAndTransport();
    const unitBefore = unit(state, unitId);
    const admissionId = movement(state, movementId).admissionId!;
    const transportId = movement(state, movementId).transport?.id;

    const withdrawn = wardFlowReducer(state, {
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: "coordinator",
      now: NOW + 10,
      referralId,
    });
    expect(withdrawn.rejections).toEqual([]);

    expect(unit(withdrawn, unitId).allocatable.value).toBe(unitBefore.allocatable.value + 1);
    const closedMovement = movement(withdrawn, movementId);
    expect(closedMovement.admissionId).toBeUndefined();
    expect(withdrawn.admissions.some((candidate) => candidate.id === admissionId)).toBe(false);
    expect(closedMovement.transport?.id).toBe(transportId);
    expect(closedMovement.transport?.cancelledAt).toBe(NOW + 10);
    expect(closedMovement.closure?.outcome).toBe("did_not_proceed");
  });

  it("refuses the whole event, unchanged, when a linked open movement's transport has already been collected", () => {
    const { state, movementId, referralId } = referredMovementHoldingBedAndTransport();
    const ready = wardFlowReducer(state, { type: "HANDOVER_READY", role: "ed", now: NOW + 1, movementId });
    const accepted = wardFlowReducer(ready, { type: "TRANSPORT_ACCEPTED", role: "officer", now: NOW + 2, movementId });
    const enRoute = wardFlowReducer(accepted, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW + 3,
      movementId,
    });
    const collected = wardFlowReducer(enRoute, {
      type: "PATIENT_COLLECTED",
      role: "officer",
      now: NOW + 4,
      movementId,
    });
    expect(collected.rejections, "the walk to collected must be accepted in full").toEqual([]);

    const attempt = wardFlowReducer(collected, {
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: "coordinator",
      now: NOW + 5,
      referralId,
    });
    expect(attempt.rejections.length).toBeGreaterThan(0);
    expect(attempt.rejections[0].reason).toContain(movementId);
    expect(attempt.movements).toEqual(collected.movements);
    expect(attempt.units).toEqual(collected.units);
    expect(attempt.admissions).toEqual(collected.admissions);
    expect(attempt.referrals).toEqual(collected.referrals);
  });

  /**
   * `referredMovementHoldingBedAndTransport` above walks exactly ONE movement to a held bed and a
   * booked transport, so it cannot tell `linkedOpenMovements = state.movements.filter(...)` (the
   * current, correct implementation) apart from a regression back to `.find` — a single-element
   * array and `.find`'s first match look identical from the outside. This drives a SECOND movement
   * off the SAME referral to build a genuine two-movement fixture and asserts the cascade reaches
   * both.
   *
   * 🔴 **CORRECTED 2026-09-17, R5 (`docs/ward-flow/plans/2026-09-16-fix-plan-referral-model.md`,
   * WF-09).** This used to build the second movement with a SECOND live `RAISE_REFERRAL` dispatch
   * carrying the same `referralId`, on the reasoning (quoted here until this correction, because
   * the reading that made it true is what a reader would otherwise re-derive) that "nothing here or
   * in RAISE_REFERRAL prevents a referral linking to more than one open movement... it only checks
   * the referral exists and is addressed to the raising department, never that it has not already
   * been raised from before." **That reasoning is now false.** WF-09 added exactly the guard this
   * fixture used to exploit: a second `RAISE_REFERRAL` from a referral with an already-open linked
   * movement is refused, by design (`tests/ward-raise-referral-uniqueness.test.ts`). So the second
   * `RAISE_REFERRAL` call below is now a WALK-IN — no `referralId` — and the link is spliced onto
   * the resulting movement directly afterwards, the ONLY way left to build this exact state: two
   * movements simultaneously open and both linked to one referral is no longer reachable through
   * the live event path at all (`Movement.referralId` has exactly one writer, `RAISE_REFERRAL`,
   * and R5 is now that writer's own guard against this shape). The splice writes nothing
   * `RAISE_REFERRAL` would not itself have written had the guard allowed it — the same
   * `referralId: referral.id` a first raise gets — so the fixture still proves the CASCADE code
   * generalises to N linked movements, which is Fix 5's own claim and is independent of whether
   * RAISE_REFERRAL can currently produce N > 1 by itself.
   */
  function twoLinkedMovementsHoldingBedAndTransport(unitId = CAPACITY_UNIT) {
    const state = withRoom(seedWardFlowState(), unitId);
    const referred = communityRefersToEmergencyDepartment(state);
    expect(referred.rejections).toEqual([]);
    const referral = referred.referrals.at(-1)!;

    const raisedFirst = departmentRaisesJourney(referred, referral.id);
    expect(raisedFirst.rejections).toEqual([]);
    const firstMovementId = raisedFirst.movements.at(-1)!.id;
    expect(movement(raisedFirst, firstMovementId).referralId).toBe(referral.id);

    const raisedSecondWalkIn = wardFlowReducer(raisedFirst, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: ATTENDED_ED,
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
    expect(raisedSecondWalkIn.rejections).toEqual([]);
    const secondMovementId = raisedSecondWalkIn.movements.at(-1)!.id;
    expect(secondMovementId).not.toBe(firstMovementId);
    expect(
      movement(raisedSecondWalkIn, secondMovementId).referralId,
      "must start as a walk-in, or the splice below is not this test's only edit",
    ).toBeUndefined();
    const raisedSecond: WardFlowState = {
      ...raisedSecondWalkIn,
      movements: raisedSecondWalkIn.movements.map((candidate) =>
        candidate.id === secondMovementId ? { ...candidate, referralId: referral.id } : candidate,
      ),
    };
    expect(movement(raisedSecond, secondMovementId).referralId).toBe(referral.id);

    let next = raisedSecond;
    for (const movementId of [firstMovementId, secondMovementId]) {
      for (const step of [
        {
          type: "REFER_TO_UNITS",
          role: "coordinator",
          unitIds: [unitId],
          overrideReason: "The bed information is known to be out of date",
        },
        {
          type: "ACCEPT_IN_PRINCIPLE",
          role: "ward",
          unitId,
          overrideReason: "The bed information is known to be out of date",
        },
        { type: "PULL_PATIENT", role: "ward", unitId },
        {
          type: "BOOK_TRANSPORT",
          role: "ed",
          provider: TRANSPORT_PROVIDERS[0],
          escortRequired: false,
          cadNumber: "CAD-STUB-0001",
          transportLegalStatus: "voluntary",
          estimatedAt: 0,
        },
      ] as const) {
        next = wardFlowReducer(next, { ...step, now: NOW, movementId } as never);
        expect(
          next.rejections,
          `${step.type} for movement ${movementId} was refused: ${next.rejections.at(-1)?.reason}`,
        ).toEqual([]);
      }
    }
    expect(movement(next, firstMovementId).admissionId).toBeDefined();
    expect(movement(next, secondMovementId).admissionId).toBeDefined();
    expect(movement(next, firstMovementId).transport?.collectedAt).toBeUndefined();
    expect(movement(next, secondMovementId).transport?.collectedAt).toBeUndefined();
    return { state: next, referralId: referral.id, firstMovementId, secondMovementId, unitId };
  }

  it("cascades to BOTH linked open movements — refunds both beds, deletes both admissions, cancels both transports and closes both movements", () => {
    const { state, referralId, firstMovementId, secondMovementId, unitId } = twoLinkedMovementsHoldingBedAndTransport();
    const unitBefore = unit(state, unitId);
    const firstAdmissionId = movement(state, firstMovementId).admissionId!;
    const secondAdmissionId = movement(state, secondMovementId).admissionId!;
    const firstTransportId = movement(state, firstMovementId).transport?.id;
    const secondTransportId = movement(state, secondMovementId).transport?.id;

    const withdrawn = wardFlowReducer(state, {
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: "coordinator",
      now: NOW + 10,
      referralId,
    });
    expect(withdrawn.rejections).toEqual([]);

    // Two beds back, not one — the whole point of this fixture over the single-movement case
    // above, which cannot distinguish `.filter` from `.find`.
    expect(unit(withdrawn, unitId).allocatable.value).toBe(unitBefore.allocatable.value + 2);

    const firstClosed = movement(withdrawn, firstMovementId);
    const secondClosed = movement(withdrawn, secondMovementId);
    expect(firstClosed.admissionId).toBeUndefined();
    expect(secondClosed.admissionId).toBeUndefined();
    expect(withdrawn.admissions.some((candidate) => candidate.id === firstAdmissionId)).toBe(false);
    expect(withdrawn.admissions.some((candidate) => candidate.id === secondAdmissionId)).toBe(false);
    expect(firstClosed.transport?.id).toBe(firstTransportId);
    expect(secondClosed.transport?.id).toBe(secondTransportId);
    expect(firstClosed.transport?.cancelledAt).toBe(NOW + 10);
    expect(secondClosed.transport?.cancelledAt).toBe(NOW + 10);
    expect(firstClosed.closure?.outcome).toBe("did_not_proceed");
    expect(secondClosed.closure?.outcome).toBe("did_not_proceed");
  });
});

describe("Fix 6: CANCEL_TRANSPORT does not skip the ED's own handover act", () => {
  it("leaves the movement at pulled when transport is cancelled before HANDOVER_READY", () => {
    const { state: pulled, movementId } = pulledMovement();
    const booked = wardFlowReducer(pulled, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW + 1,
      movementId,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: false,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    expect(booked.rejections).toEqual([]);
    expect(movement(booked, movementId).stage).toBe("pulled");

    const cancelled = wardFlowReducer(booked, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: NOW + 2,
      movementId,
      reason: CANCEL_TRANSPORT_REASONS[0],
    });
    expect(cancelled.rejections).toEqual([]);
    const after = movement(cancelled, movementId);
    expect(after.stage).toBe("pulled");
    // No spurious stage-change entry recorded for a transition that never happened.
    expect(after.stageChanges.some((entry) => entry.to === "handover_ready")).toBe(false);
  });

  it("still advances to handover_ready when transport is cancelled AFTER HANDOVER_READY (existing behaviour, unchanged)", () => {
    const { state: pulled, movementId } = pulledMovement();
    const booked = wardFlowReducer(pulled, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW + 1,
      movementId,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: false,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    const ready = wardFlowReducer(booked, { type: "HANDOVER_READY", role: "ed", now: NOW + 2, movementId });
    expect(ready.rejections).toEqual([]);
    expect(movement(ready, movementId).stage).toBe("handover_ready");

    const cancelled = wardFlowReducer(ready, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: NOW + 3,
      movementId,
      reason: CANCEL_TRANSPORT_REASONS[0],
    });
    expect(cancelled.rejections).toEqual([]);
    expect(movement(cancelled, movementId).stage).toBe("handover_ready");
  });
});

describe("Fix 7: CANCEL_TRANSPORT copies bookedBy onto the replacement job", () => {
  const ACCEPTING_UNIT = "fre-adult-open";
  const BOOKING_WARD = "rph-adult-secure";

  function wardBookedMovement() {
    const movementId = "WF-001";
    const events = [
      { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [ACCEPTING_UNIT] },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: ACCEPTING_UNIT },
      { type: "PULL_PATIENT", role: "ward", unitId: ACCEPTING_UNIT },
      {
        type: "BOOK_TRANSPORT",
        role: "ward",
        provider: TRANSPORT_PROVIDERS[0],
        escortRequired: true,
        cadNumber: "CAD-STUB-0001",
        transportLegalStatus: "voluntary",
        estimatedAt: 0,
        actingUnitId: BOOKING_WARD,
      },
    ] as const;
    let state = seedWardFlowState();
    for (const event of events) {
      state = wardFlowReducer(state, { ...event, now: NOW, movementId } as never);
    }
    expect(state.rejections, "the ward-booked setup walk must be accepted in full").toEqual([]);
    return { state, movementId };
  }

  function cancel(state: WardFlowState, movementId: string, now: number) {
    return wardFlowReducer(state, {
      type: "CANCEL_TRANSPORT",
      role: "ward",
      now,
      movementId,
      reason: CANCEL_TRANSPORT_REASONS[0],
      actingUnitId: BOOKING_WARD,
    });
  }

  // 🔴 SUPERSEDED 2026-09-17, owner answer 30 (build plan item 30): "no automatic rebooking; a
  // person books again." This fix's own premise — that CANCEL_TRANSPORT installs a fresh
  // replacement job, and that job needs `bookedBy` carried onto it or the booking ward loses the
  // ability to cancel what it just created — no longer holds: no branch installs a replacement any
  // more (see the reducer's own FIFTH FIX ROUND comment above `case "CANCEL_TRANSPORT"`). There is
  // therefore no replacement job left to copy `bookedBy` onto.
  //
  // The identity check the original fix protected — a ward may cancel a job IT booked, proven
  // against `transport.bookedBy` — is untouched by owner answer 30 and is still exercised below,
  // against the FIRST cancel (the only one now possible, since the job is removed rather than
  // replaced). The second cancel this test used to prove SUCCEEDED against the replacement now
  // correctly REFUSES, for the plain reason there is nothing left to cancel — the same fact
  // `tests/ward-cancel-transport-no-bed-held.test.ts`'s own "refuses a second cancel" case proves
  // for the no-bed-held branch.
  it("lets the booking ward cancel its own job, which is removed rather than replaced", () => {
    const { state, movementId } = wardBookedMovement();

    const firstCancel = cancel(state, movementId, NOW + 1);
    expect(firstCancel.rejections).toEqual([]);
    expect(movement(firstCancel, movementId).transport).toBeUndefined();
    expect(movement(firstCancel, movementId).blocker).toBe("Transport cancelled; not booked again yet");

    const secondCancel = cancel(firstCancel, movementId, NOW + 2);
    expect(secondCancel.rejections).toHaveLength(1);
    expect(secondCancel.rejections.at(-1)?.reason).toMatch(/has no transport job to cancel/);
    const unwinds = movement(secondCancel, movementId).unwinds.filter((entry) => entry.kind === "transport_cancelled");
    expect(unwinds).toHaveLength(1);
  });
});

describe("Fix 8: PATIENT_ARRIVED requires a ward caller to state its actingUnitId", () => {
  it("refuses a ward event with no actingUnitId, and accepts one naming the accepting unit", () => {
    const seeded = seedWardFlowState();
    const moving = seeded.movements.find((candidate) => candidate.stage === "moving" && !candidate.closure);
    expect(moving).toBeDefined();
    if (!moving || !moving.acceptedUnitId) return;

    const noUnit = wardFlowReducer(seeded, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW,
      movementId: moving.id,
    });
    expect(noUnit.rejections.length).toBeGreaterThan(0);
    expect(noUnit.rejections[0].reason).toContain("actingUnitId");
    expect(movement(noUnit, moving.id).stage).toBe("moving");

    const withUnit = wardFlowReducer(seeded, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW,
      movementId: moving.id,
      actingUnitId: moving.acceptedUnitId,
    });
    expect(withUnit.rejections).toEqual([]);
    expect(movement(withUnit, moving.id).stage).toBe("arrived");
  });
});

describe("Fix 9: RECORD_LEGAL_FORM_RECEIVED requires a receivable legal form (owner ruling 2026-09-25: nine forms, not only Form 1A)", () => {
  it("refuses a movement with no legal form at all", () => {
    const seeded = seedWardFlowState();
    const noForm = seeded.movements.find((candidate) => candidate.legalForm === undefined && !candidate.closure);
    expect(noForm).toBeDefined();
    if (!noForm) return;

    const result = wardFlowReducer(seeded, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: "ed",
      now: NOW,
      movementId: noForm.id,
    });
    expect(result.rejections.length).toBeGreaterThan(0);
    expect(result.rejections[0].reason).toContain("receivable legal form");
    expect(movement(result, noForm.id).legalFormReceivedAt).toBeUndefined();
  });

  it("refuses a movement carrying a non-1A form (3B)", () => {
    const seeded = seedWardFlowState();
    const nonForm1A = seeded.movements.find((candidate) => candidate.legalForm?.code === "3B" && !candidate.closure);
    expect(nonForm1A).toBeDefined();
    if (!nonForm1A) return;

    const result = wardFlowReducer(seeded, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: "ed",
      now: NOW,
      movementId: nonForm1A.id,
    });
    expect(result.rejections.length).toBeGreaterThan(0);
    expect(result.rejections[0].reason).toContain("receivable legal form");
    expect(movement(result, nonForm1A.id).legalFormReceivedAt).toBeUndefined();
  });

  it("accepts a movement carrying a Form 1A", () => {
    const seeded = seedWardFlowState();
    const form1A = seeded.movements.find((candidate) => candidate.legalForm?.code === "1A" && !candidate.closure);
    expect(form1A).toBeDefined();
    if (!form1A) return;

    const result = wardFlowReducer(seeded, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: "ed",
      now: NOW,
      movementId: form1A.id,
    });
    expect(result.rejections).toEqual([]);
    expect(movement(result, form1A.id).legalFormReceivedAt).toBe(NOW);
  });
});
