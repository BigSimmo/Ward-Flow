import { describe, expect, it } from "vitest";

import { waitedHours as modelWaitedHours } from "../src/components/ward-management/search/patient-search-model";
import { matchesWait, waitedHours } from "../src/components/ward-management/search/search-filters";
import { isArrivalLate as isMovementArrivalLate } from "../src/components/ward-management/ward-derivations";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { ARRIVAL_LATE_AFTER_MINUTES, isArrivalLate } from "../src/components/ward-management/ward-legal-clock";
import type { Movement } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Data-logic edge cases from the 8 Nov 2026 review. Synthetic seed data only.
 */
const NOW = NOW_ANCHOR;
const HOUR = 60;

function seedMovement(): Movement {
  return seedWardFlowState().movements[0]!;
}

describe("waitedHours stops when the journey ends", () => {
  it("counts to now while the movement is open", () => {
    const open: Movement = { ...seedMovement(), stage: "accepted_awaiting_bed", openedAt: NOW - 30 * HOUR };
    delete open.closure;
    expect(waitedHours(open, NOW)).toBe(30);
  });

  it("stops at closure.at for a closed movement", () => {
    const closed: Movement = {
      ...seedMovement(),
      openedAt: NOW - 30 * HOUR,
      closure: { at: NOW - 28 * HOUR, outcome: "did_not_proceed", reason: "Withdrawn" },
    };
    expect(waitedHours(closed, NOW)).toBe(2);
    // A two-hour journey that closed yesterday is not "waiting over 24 hours".
    expect(matchesWait({ kind: "movement", movement: closed }, "over24", NOW)).toBe(false);
    expect(matchesWait({ kind: "movement", movement: closed }, "under6", NOW)).toBe(true);
  });

  it("stops at the recorded arrival for an arrived movement with no closure", () => {
    const base = seedMovement();
    const arrived: Movement = {
      ...base,
      stage: "arrived",
      openedAt: NOW - 30 * HOUR,
      stageChanges: [...base.stageChanges, { at: NOW - 25 * HOUR, to: "arrived", by: "ward" }],
    };
    delete arrived.closure;
    expect(waitedHours(arrived, NOW)).toBe(5);
  });

  it("is one definition shared by the search filters and the Show facets", () => {
    expect(modelWaitedHours).toBe(waitedHours);
  });
});

describe("isArrivalLate treats a closed movement as not late", () => {
  const estimated = NOW - ARRIVAL_LATE_AFTER_MINUTES - 1;

  it("is late while open, not once closed", () => {
    expect(isArrivalLate(estimated, "pulled", NOW)).toBe(true);
    expect(isArrivalLate(estimated, "pulled", NOW, true)).toBe(false);
  });

  it("reads the movement's closure through the movement-level helper", () => {
    const base: Movement = {
      ...seedMovement(),
      stage: "pulled",
      arrivalDetails: { ...seedMovement().arrivalDetails, estimatedArrivalAt: estimated } as Movement["arrivalDetails"],
    };
    delete base.closure;
    expect(isMovementArrivalLate(base, NOW)).toBe(true);
    const withdrawn: Movement = {
      ...base,
      closure: { at: NOW - 5, outcome: "did_not_proceed", reason: "Cancelled" },
    };
    expect(isMovementArrivalLate(withdrawn, NOW)).toBe(false);
  });
});

describe("PULL_PATIENT resolves the patient once for the bed check and the new stay", () => {
  const MOVEMENT_ID = "WF-009";
  const UNIT_ID = "rph-adult-secure";

  function acceptedAwaitingBed(): WardFlowState {
    let state: WardFlowState = seedWardFlowState();
    for (const event of [
      { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [UNIT_ID] },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: UNIT_ID },
    ] as const) {
      state = wardFlowReducer(state, { ...event, now: NOW, movementId: MOVEMENT_ID } as never);
    }
    expect(state.rejections).toEqual([]);
    return state;
  }

  /** Points the movement at a synthetic referral for `referralPatientId`, while the movement's
   *  own `patientId` names someone else. */
  function withReferralFor(state: WardFlowState, referralPatientId: string, movementPatientId: string) {
    const referral = { ...state.referrals[0]!, id: "R-EDGE-1", patientId: referralPatientId };
    return {
      ...state,
      referrals: [...state.referrals, referral],
      movements: state.movements.map((m) =>
        m.id === MOVEMENT_ID ? { ...m, referralId: referral.id, patientId: movementPatientId } : m,
      ),
    } as WardFlowState;
  }

  function pull(state: WardFlowState): WardFlowState {
    return wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: MOVEMENT_ID,
      unitId: UNIT_ID,
    });
  }

  it("refuses when the referral's patient already occupies a bed", () => {
    const before = acceptedAwaitingBed();
    const bedded = new Set(
      before.admissions
        .filter((a) => a.state === "occupied" || a.state === "pulled")
        .map((a) => a.patientId)
        .flatMap((id) => (id === null ? [] : [id])),
    );
    const holder = [...bedded][0]!;
    const free = before.patients.find((p) => !bedded.has(p.id))!.id;
    const after = pull(withReferralFor(before, holder, free));
    expect(after.rejections.at(-1)?.reason).toBe(
      "This patient already has a bed pulled or occupies a ward; use a recorded transfer.",
    );
  });

  it("gives the new stay the same patient the check used", () => {
    const before = acceptedAwaitingBed();
    const bedded = new Set(
      before.admissions
        .filter((a) => a.state === "occupied" || a.state === "pulled")
        .map((a) => a.patientId)
        .flatMap((id) => (id === null ? [] : [id])),
    );
    const [first, second] = before.patients.filter((p) => !bedded.has(p.id));
    const after = pull(withReferralFor(before, first!.id, second!.id));
    expect(after.rejections).toEqual([]);
    const admissionId = after.movements.find((m) => m.id === MOVEMENT_ID)!.admissionId;
    expect(after.admissions.find((a) => a.id === admissionId)?.patientId).toBe(first!.id);
  });
});
