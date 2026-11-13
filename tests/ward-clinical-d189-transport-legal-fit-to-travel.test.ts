import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  isValidStoredWardFlowState,
  storedStateRestoreProblem,
} from "@/components/ward-management/ward-flow-storage-validation";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { transportBookingSubmission } from "@/components/ward-management/transport/transport-booking-form";
import { fitToTravelGaps, handoverReadyGaps } from "@/components/ward-management/ward-transport-checks";

/**
 * D-187 item 10 and D-189 item 9(e) (Josh, 13 Nov 2026): booking transport and Mark handover ready
 * with no medical clearance recorded ask for a reason. Neither is blocked: the engine takes the
 * press with or without one, and a given reason is kept at step "booked" or "handover_ready".
 * Synthetic seed records only.
 */

const MOVEMENT = "WF-011";

function movementOf(state: WardFlowState): Movement {
  return state.movements.find((movement) => movement.id === MOVEMENT)!;
}

function book(state: WardFlowState, withReason: boolean): WardFlowState {
  return wardFlowReducer(state, {
    type: "BOOK_TRANSPORT",
    role: "coordinator",
    now: NOW_ANCHOR,
    movementId: MOVEMENT,
    provider: "Ambulance service",
    escortRequired: true,
    cadNumber: "CAD-SYN-1",
    transportLegalStatus: "involuntary",
    estimatedAt: NOW_ANCHOR + 30,
    ...(withReason ? { exception: { gaps: ["fit_to_travel_missing"], reason: "treating_team_confirmed" } } : {}),
  });
}

function handover(state: WardFlowState, withReason: boolean): WardFlowState {
  return wardFlowReducer(state, {
    type: "HANDOVER_READY",
    role: "coordinator",
    now: NOW_ANCHOR + 5,
    movementId: MOVEMENT,
    ...(withReason ? { exception: { gaps: ["fit_to_travel_missing"], reason: "urgent_to_follow" } } : {}),
  });
}

describe("the fixture", () => {
  it("is a held bed with no transport and no medical clearance recorded", () => {
    const movement = movementOf(seedWardFlowState());
    expect(movement.stage).toBe("pulled");
    expect(movement.transport).toBeUndefined();
    expect(movement.medicalClearance).toBeUndefined();
  });
});

describe("the gaps the screens ask about", () => {
  it("asks fit to travel until clearance is recorded as cleared", () => {
    expect(fitToTravelGaps(undefined)).toEqual(["fit_to_travel_missing"]);
    // D-207: recorded as not cleared has its own line.
    expect(fitToTravelGaps({ cleared: false })).toEqual(["fit_to_travel_not_cleared"]);
    expect(fitToTravelGaps({ cleared: true })).toEqual([]);
  });

  it("asks at handover only on a live transport job (no transport is asked at arrival)", () => {
    const booked = movementOf(book(seedWardFlowState(), false));
    expect(handoverReadyGaps(booked)).toEqual(["fit_to_travel_missing"]);
    expect(handoverReadyGaps({ ...booked, medicalClearance: { cleared: true, at: NOW_ANCHOR } })).toEqual([]);
    expect(handoverReadyGaps({ ...booked, transport: undefined })).toEqual([]);
    expect(handoverReadyGaps({ ...booked, transport: { ...booked.transport!, cancelledAt: NOW_ANCHOR } })).toEqual([]);
  });

  it("the booking form books with or without a fit to travel reason, recording only a chosen one", () => {
    const answers = {
      provider: "Ambulance service" as const,
      escortRequired: true,
      cadNumber: "CAD-1",
      transportLegalStatus: "involuntary" as const,
      estimatedTime: "",
      estimatedDay: undefined,
    };
    const record = { legalStatus: "Involuntary inpatient" as const, legalForm: undefined };
    // D-189 item 9(e), review question 1: the press goes through without a reason, and none is recorded.
    const withoutReason = transportBookingSubmission(answers, "", record, NOW_ANCHOR);
    expect(withoutReason).toBeDefined();
    expect(withoutReason?.exception).toBeUndefined();
    expect(transportBookingSubmission(answers, "paper_sighted", record, NOW_ANCHOR)?.exception).toEqual({
      gaps: ["fit_to_travel_missing"],
      reason: "paper_sighted",
    });
    const cleared = { ...record, medicalClearance: { cleared: true, at: NOW_ANCHOR } };
    expect(transportBookingSubmission(answers, "", cleared, NOW_ANCHOR)?.exception).toBeUndefined();
  });
});

describe("the engine never refuses for fit to travel", () => {
  it("books and readies the handover with no clearance, recording each reason at its step", () => {
    const booked = book(seedWardFlowState(), true);
    const ready = handover(booked, true);
    expect(ready.rejections).toHaveLength(seedWardFlowState().rejections.length);
    const movement = movementOf(ready);
    expect(movement.stage).toBe("handover_ready");
    expect(movement.transport!.exceptions).toEqual([
      {
        at: NOW_ANCHOR,
        by: "coordinator",
        step: "booked",
        gaps: ["fit_to_travel_missing"],
        reason: "treating_team_confirmed",
      },
      {
        at: NOW_ANCHOR + 5,
        by: "coordinator",
        step: "handover_ready",
        gaps: ["fit_to_travel_missing"],
        reason: "urgent_to_follow",
      },
    ]);
  });

  it("accepts both presses without a reason too", () => {
    const seed = seedWardFlowState();
    const ready = handover(book(seed, false), false);
    expect(ready.rejections).toHaveLength(seed.rejections.length);
    const movement = movementOf(ready);
    expect(movement.stage).toBe("handover_ready");
    expect(movement.transport!.exceptions).toBeUndefined();
  });

  it("refuses a malformed handover reason, as at every other step", () => {
    const booked = book(seedWardFlowState(), false);
    const refused = wardFlowReducer(booked, {
      type: "HANDOVER_READY",
      role: "coordinator",
      now: NOW_ANCHOR + 5,
      movementId: MOVEMENT,
      exception: { gaps: ["fit_to_travel_missing"], reason: "typed text" as never },
    });
    expect(movementOf(refused).stage).toBe("pulled");
    expect(refused.rejections.at(-1)?.reason).toMatch(/^HANDOVER_READY exception reason/);
  });
});

describe("a saved day with the new step restores", () => {
  it("passes the storage check with a handover_ready exception on the job", () => {
    const ready = handover(book(seedWardFlowState(), true), true);
    const saved = JSON.parse(JSON.stringify({ ...ready, rejections: [] }));
    expect(isValidStoredWardFlowState(saved)).toBe(true);
    expect(storedStateRestoreProblem(saved)).toBeUndefined();
  });
});
