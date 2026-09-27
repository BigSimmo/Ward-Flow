// tests/ward-raise-referral-uniqueness.test.ts
//
// R5 (docs/ward-flow/plans/2026-09-16-fix-plan-referral-model.md, WF-09): RAISE_REFERRAL had no
// uniqueness guard at all. A second open movement could be raised from the same referral, and a
// journey could be raised from an addressing its own referrer had withdrawn or its own department
// had declined — none of it refused. Owner Q11 confirms the shape: refused WHILE an earlier
// journey from the same referral is open, allowed once that earlier one has closed.
//
// ⚠️ WALKS THE REAL FLOW, matching `ward-movement-referral-link.test.ts`'s own reasoning: a
// hand-built `Movement`/`Referral` pair would say nothing about whether RAISE_REFERRAL itself
// resolves and refuses correctly.
import { describe, expect, it } from "vitest";

import { ED_DECLINE_REASONS } from "../src/components/ward-management/ward-model";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { allEmergencyDepartments, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const NOW = NOW_ANCHOR;

/** A real department, matching `ward-movement-referral-link.test.ts`'s own `ATTENDED_ED`. */
const ED_ID = "jhc-ed";
/** A unit REFER_TO_UNITS can name without touching any eligibility gate — see that test's own note. */
const UNIT_ID = "scgh-adult-open";

/** A community team refers somebody to an emergency department — the front door half of ruling 8. */
function referToEd(state: WardFlowState): WardFlowState {
  return wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    ageBand: "Adult",
    destinations: [{ kind: "emergency_department", edId: ED_ID, purpose: "psychiatric_review" }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
}

/** The department raises the journey — `referralId` omitted is what a walk-in looks like. */
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

/** Closes a movement the CHEAP way — refer it to a unit, then have the referrer withdraw it, which
 *  closes it (`did_not_proceed`) without walking the whole pull/transport/arrival pipeline. Proven
 *  as a genuine closure by `isOpen`'s own definition: `!movement.closure` becomes false. */
function closeMovement(state: WardFlowState, movementId: string): WardFlowState {
  const referred = wardFlowReducer(state, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: NOW,
    movementId,
    unitIds: [UNIT_ID],
  });
  return wardFlowReducer(referred, {
    type: "WITHDRAW_REFERRAL",
    role: "ed",
    now: NOW,
    movementId,
  });
}

describe("RAISE_REFERRAL refuses a second journey while an earlier one is still open", () => {
  it("refuses a second raise from the same referral while the first movement is open, naming it", () => {
    const referred = referToEd(seedWardFlowState());
    expect(referred.rejections).toEqual([]);
    const referral = referred.referrals.at(-1)!;

    const first = raiseJourney(referred, referral.id);
    expect(first.rejections).toEqual([]);
    const firstMovement = first.movements.at(-1)!;

    const second = raiseJourney(first, referral.id);
    expect(second.rejections).toHaveLength(1);
    expect(
      second.rejections[0].reason,
      `refused, but the reason never names the open movement ${firstMovement.id}: ${second.rejections[0].reason}`,
    ).toContain(firstMovement.id);
    // And no second movement was ever appended — the refusal is a real refusal, not a cosmetic one.
    expect(second.movements).toHaveLength(first.movements.length);
  });

  it("accepts the identical second raise once the first movement has closed", () => {
    const referred = referToEd(seedWardFlowState());
    const referral = referred.referrals.at(-1)!;

    const first = raiseJourney(referred, referral.id);
    const firstMovement = first.movements.at(-1)!;

    const closed = closeMovement(first, firstMovement.id);
    expect(
      closed.rejections,
      `closing the first movement was itself refused: ${closed.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    expect(
      closed.movements.find((m) => m.id === firstMovement.id)?.closure,
      "the control: the first movement must actually be closed, or this test proves nothing",
    ).toBeDefined();

    const second = raiseJourney(closed, referral.id);
    expect(
      second.rejections,
      `a raise after the earlier journey closed must be accepted (owner Q11): ${second.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    const secondMovement = second.movements.at(-1)!;
    expect(secondMovement.id).not.toBe(firstMovement.id);
    expect(secondMovement.referralId).toBe(referral.id);
  });

  /*
   * P2-6 (Ward Lead audit, 2026-09-17): the guard used to let a second raise through once the
   * first movement had reached `arrived`, treating a fulfilled referral the same as one that
   * genuinely `did_not_proceed`. An arrival is the referral's purpose being MET, not abandoned —
   * raising a second journey from a referral that already delivered its patient is the same
   * double-journey shape this guard exists to catch, not the re-raise owner Q11 describes.
   */
  it("still refuses a second raise once the first movement has ARRIVED, unlike a did_not_proceed close", () => {
    const referred = referToEd(seedWardFlowState());
    const referral = referred.referrals.at(-1)!;

    let state = raiseJourney(referred, referral.id);
    const firstMovement = state.movements.at(-1)!;
    expect(state.rejections).toEqual([]);

    for (const event of [
      { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [UNIT_ID] },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: UNIT_ID },
      { type: "PULL_PATIENT", role: "ward", unitId: UNIT_ID },
      {
        type: "BOOK_TRANSPORT",
        role: "ed",
        provider: "Ambulance service",
        escortRequired: true,
        cadNumber: "CAD-STUB-0001",
        transportLegalStatus: "voluntary",
        estimatedAt: 0,
      },
      { type: "HANDOVER_READY", role: "ed" },
      { type: "TRANSPORT_ACCEPTED", role: "officer" },
      { type: "TRANSPORT_EN_ROUTE", role: "officer" },
      { type: "PATIENT_COLLECTED", role: "officer" },
      { type: "PATIENT_ARRIVED", role: "officer" },
    ] as const) {
      state = wardFlowReducer(state, { ...event, now: NOW, movementId: firstMovement.id } as never);
    }
    expect(state.rejections, "the walk to arrival itself must succeed, or this test proves nothing").toEqual([]);
    expect(state.movements.find((m) => m.id === firstMovement.id)?.closure?.outcome).toBe("arrived");

    const second = raiseJourney(state, referral.id);
    expect(
      second.rejections.slice(state.rejections.length),
      "an arrival is the referral's purpose met, not a did_not_proceed close, and must not unlock a second raise",
    ).toHaveLength(1);
    expect(second.movements).toHaveLength(state.movements.length);
  });
});

describe("RAISE_REFERRAL refuses a journey from an addressing that can no longer answer", () => {
  it("refuses when the referrer has withdrawn the referral", () => {
    const referred = referToEd(seedWardFlowState());
    const referral = referred.referrals.at(-1)!;

    const withdrawn = wardFlowReducer(referred, {
      type: "RECORD_REFERRER_WITHDRAWAL",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
    });
    expect(withdrawn.rejections, `the withdrawal itself was refused: ${withdrawn.rejections.at(-1)?.reason}`).toEqual(
      [],
    );

    const raised = raiseJourney(withdrawn, referral.id);
    expect(raised.rejections).toHaveLength(1);
    expect(raised.rejections[0].reason).toContain(referral.id);
    expect(raised.movements).toHaveLength(withdrawn.movements.length);
  });

  it("refuses when this department has declined the referral", () => {
    const referred = referToEd(seedWardFlowState());
    const referral = referred.referrals.at(-1)!;

    const declined = wardFlowReducer(referred, {
      type: "DECLINE_REFERRAL",
      role: "ed",
      now: NOW,
      referralId: referral.id,
      destinationKind: "emergency_department",
      // An emergency department declines from its own list since the community-decline fix
      // (reasons are checked against the addressed destination's vocabulary).
      reason: ED_DECLINE_REASONS[0],
    });
    expect(declined.rejections, `the decline itself was refused: ${declined.rejections.at(-1)?.reason}`).toEqual([]);

    const raised = raiseJourney(declined, referral.id);
    expect(raised.rejections).toHaveLength(1);
    expect(raised.rejections[0].reason).toContain(referral.id);
    expect(raised.movements).toHaveLength(declined.movements.length);
  });
});

/*
 * P2-6 (Ward Lead audit, 2026-09-17): the OTHER half of the same double-journey shape, from the
 * referral side rather than the movement side. A front-door referral can be addressed to a
 * psychiatric ward AND an emergency department at once (FD-21) — `RAISE_REFERRAL`'s own guard
 * above only stops a second MOVEMENT being raised; it says nothing about the ward arm answering
 * while the ED arm's own movement is still open. Fixture shape matches
 * `tests/ward-referral-visibility.test.ts`'s own `cancelledArmReferral()`, which already proves
 * this exact two-destination referral and `bty-youth` acceptance combination is otherwise clean.
 */
describe("ACCEPT_REFERRAL (ward arm) refuses while a linked movement is open", () => {
  function twoDestinationReferral(state: WardFlowState) {
    const edId = allEmergencyDepartments()[0].id;
    const received = wardFlowReducer(state, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW,
      ageBand: "Youth",
      destinations: [
        {
          kind: "psychiatric_ward",
          sex: "Female",
          gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        { kind: "emergency_department", edId, purpose: "bed" },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
    expect(received.rejections, "the two-destination referral itself was refused").toEqual([]);
    return { state: received, referral: received.referrals.at(-1)!, edId };
  }

  it("refuses the ward's acceptance while the ED's own raised movement is still open", () => {
    const { state, referral, edId } = twoDestinationReferral(seedWardFlowState());
    const raised = wardFlowReducer(state, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId,
      referralId: referral.id,
      draft: {
        cohort: "Youth",
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
    expect(raised.rejections, "raising the ED's own journey was refused").toEqual([]);
    const linkedMovement = raised.movements.at(-1)!;
    expect(linkedMovement.closure).toBeUndefined();

    const accepted = wardFlowReducer(raised, {
      type: "ACCEPT_REFERRAL",
      role: "ward",
      now: NOW + 5,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId: "bty-youth",
    });
    expect(accepted.rejections.slice(raised.rejections.length)).toHaveLength(1);
    expect(accepted.rejections.at(-1)?.reason).toContain(linkedMovement.id);
    const referralAfter = accepted.referrals.find((r) => r.id === referral.id)!;
    expect(
      referralAfter.destinations.find((d) => d.destination.kind === "psychiatric_ward")?.state,
      "refused, so the ward arm must still read queued",
    ).toBe("queued");
  });

  it("accepts the same ward answer once the linked movement has closed", () => {
    const { state, referral, edId } = twoDestinationReferral(seedWardFlowState());
    const raised = wardFlowReducer(state, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId,
      referralId: referral.id,
      draft: {
        cohort: "Youth",
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
    const linkedMovement = raised.movements.at(-1)!;

    // WITHDRAW_REFERRAL's pre-acceptance path requires a live `referredUnitIds` entry to take
    // back (`ward-flow-reducer.ts`'s own "holds no live referral to withdraw" refusal) — this
    // movement was only ever RAISE_REFERRAL'd, never REFER_TO_UNITS'd, so it is referred to a real
    // unit first, the same two-step `closeMovement` helper above uses for the identical reason.
    // `bty-youth`, not `UNIT_ID` (an adult unit): this movement's own `cohort` is `"Youth"`.
    const referredToUnit = wardFlowReducer(raised, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: linkedMovement.id,
      unitIds: ["bty-youth"],
    });
    expect(
      referredToUnit.rejections.slice(raised.rejections.length),
      "referring the linked movement to a unit was refused",
    ).toEqual([]);

    const closed = wardFlowReducer(referredToUnit, {
      type: "WITHDRAW_REFERRAL",
      role: "ed",
      now: NOW + 1,
      movementId: linkedMovement.id,
    });
    expect(
      closed.rejections.slice(referredToUnit.rejections.length),
      "closing the linked movement was refused",
    ).toEqual([]);
    expect(closed.movements.find((m) => m.id === linkedMovement.id)?.closure).toBeDefined();

    const accepted = wardFlowReducer(closed, {
      type: "ACCEPT_REFERRAL",
      role: "ward",
      now: NOW + 5,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId: "bty-youth",
    });
    expect(
      accepted.rejections.slice(closed.rejections.length),
      `accepted after the linked movement closed, but was refused: ${accepted.rejections.at(-1)?.reason}`,
    ).toEqual([]);
  });
});
