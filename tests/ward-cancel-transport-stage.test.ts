// tests/ward-cancel-transport-stage.test.ts
//
// Catcher for the CANCEL_TRANSPORT stage-after-cancel defect found in the 2026-09-16 adversarial
// review of commit 65aa7c54a6.
//
// `case "CANCEL_TRANSPORT"` computed `stageAfterCancel` as
// `movement.stage === "pulled" ? "pulled" : "handover_ready"`, and its own comment claimed
// `handover_ready` was the ONLY other stage this handler could ever reach — "the only other stage
// this handler can reach (`handover_ready`, since `CANCEL_TRANSPORT` refuses once `collectedAt` is
// set) keeps the existing behaviour, because there the movement really was already past handover."
//
// That claim is false. `STEP_BACK_STAGE` can move a movement with a booked, uncollected transport
// job back to ANY strictly-earlier stage without touching `transport` at all (see that case's own
// "TOUCH NOTHING ELSE" comment) — including `accepted_awaiting_bed`. `RELEASE_PULL` leaves the
// transport job in place too: it releases the BED (ruling P4-1's exact inverse of `PULL_PATIENT`),
// never the transport, and lands the movement back at `accepted_awaiting_bed`. So
// PULL_PATIENT -> BOOK_TRANSPORT -> STEP_BACK_STAGE(accepted_awaiting_bed) -> CANCEL_TRANSPORT, and
// PULL_PATIENT -> BOOK_TRANSPORT -> RELEASE_PULL -> CANCEL_TRANSPORT, both reach `CANCEL_TRANSPORT`
// with `movement.stage === "accepted_awaiting_bed"` and an uncancelled transport job — and the old
// code jumped both straight to `handover_ready`, skipping the ED's own `HANDOVER_READY` act
// entirely.
//
// The fix leaves `movement.stage` exactly where `CANCEL_TRANSPORT` found it in every case —
// cancelling a transport job never advances OR reverts the movement's stage.
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
  RELEASE_PULL_REASONS,
} from "../src/components/ward-management/ward-change-reasons";

const NOW = NOW_ANCHOR;

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

// Same fixture pairing `tests/ward-audit-engine-fixes-2026-09-16.test.ts` uses for its own
// `pulledMovement()`: `rph-adult-secure` widened for room, `WF-012` already proven to pass this
// unit's eligibility gates with no override needed.
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

function pulledAndBookedMovement(movementId = CAPACITY_MOVEMENT, unitId = CAPACITY_UNIT) {
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
  const booked = wardFlowReducer(state, {
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
  expect(booked.rejections, "the fixture's own walk to a booked transport was refused").toEqual([]);
  expect(movement(booked, movementId).stage).toBe("pulled");
  expect(movement(booked, movementId).transport?.cancelledAt).toBeUndefined();
  return { state: booked, movementId, unitId };
}

describe("CANCEL_TRANSPORT leaves the movement's stage exactly where it found it", () => {
  it("(a) STEP_BACK_STAGE to accepted_awaiting_bed, then CANCEL_TRANSPORT: stage stays accepted_awaiting_bed", () => {
    const { state: booked, movementId } = pulledAndBookedMovement();

    const steppedBack = wardFlowReducer(booked, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: NOW + 2,
      movementId,
      to: "accepted_awaiting_bed",
      reason: "recorded_in_error",
    });
    expect(steppedBack.rejections).toEqual([]);
    expect(movement(steppedBack, movementId).stage).toBe("accepted_awaiting_bed");
    // STEP_BACK_STAGE's own "TOUCH NOTHING ELSE" rule: the booked job survives the step-back
    // untouched, so CANCEL_TRANSPORT can still act on it below.
    expect(movement(steppedBack, movementId).transport?.cancelledAt).toBeUndefined();

    const cancelled = wardFlowReducer(steppedBack, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: NOW + 3,
      movementId,
      reason: CANCEL_TRANSPORT_REASONS[0],
    });
    expect(cancelled.rejections).toEqual([]);
    const after = movement(cancelled, movementId);
    expect(after.stage).toBe("accepted_awaiting_bed");
    // No spurious stage-change entry recorded for a transition that never happened.
    expect(after.stageChanges.some((entry) => entry.to === "handover_ready")).toBe(false);
  });

  it("(b) RELEASE_PULL clears transport and stage stays accepted_awaiting_bed (WF-37 / Ruling 2)", () => {
    const { state: booked, movementId } = pulledAndBookedMovement();

    // Owner ruling 2026-09-25: RELEASE_PULL refuses while a transport job is booked ("...has a
    // transport job booked; cancel it (CANCEL_TRANSPORT) before releasing the pull") — until this
    // ruling RELEASE_PULL cleared a linked job automatically (WF-37 / Ruling 2). Cancel first.
    const cancelled = wardFlowReducer(booked, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: NOW + 2,
      movementId,
      reason: CANCEL_TRANSPORT_REASONS[0],
    });
    expect(cancelled.rejections).toEqual([]);

    const released = wardFlowReducer(cancelled, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: NOW + 3,
      movementId,
      reason: RELEASE_PULL_REASONS[0],
    });
    expect(released.rejections).toEqual([]);
    expect(movement(released, movementId).stage).toBe("accepted_awaiting_bed");
    // The job stays cleared through the release — the same end state WF-37 / Ruling 2 pinned.
    expect(movement(released, movementId).transport).toBeUndefined();
  });

  it("(c) already at handover_ready, then CANCEL_TRANSPORT: stage stays handover_ready", () => {
    const { state: booked, movementId } = pulledAndBookedMovement();

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
