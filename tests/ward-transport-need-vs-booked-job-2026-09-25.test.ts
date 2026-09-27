import { describe, expect, it } from "vitest";

import { CANCEL_TRANSPORT_REASONS, GENDER_PLACEMENT_REASONS } from "../src/components/ward-management/ward-change-reasons";
import { TRANSPORT_PROVIDERS } from "../src/components/ward-management/ward-model";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Audit 2026-09-25 §3 item 4 — a booked vehicle stayed open after arrival (seen live on WF-005, job
 * TR-1005). Two halves:
 *
 * (a) `RECORD_TRANSPORT_NEED` used to write `needed: false` straight onto a live booked job — the
 *     record then said "no transport is needed" about a movement with a vehicle actually on its way.
 *     It now refuses while the job is booked and neither cancelled nor arrived: cancel it first.
 *
 * (b) `PATIENT_ARRIVED`'s "no transport needed" route checked only `collectedAt`, so a live but
 *     uncollected booked job let arrival close the movement while the vehicle stayed booked open.
 *     It now also requires no live (uncancelled) job, and on that route never writes `arrivedAt`
 *     onto a job — including a cancelled one still sitting on the movement.
 */

const NOW = NOW_ANCHOR;
const CAPACITY_UNIT = "rph-adult-secure";
const CAPACITY_MOVEMENT = "WF-012";

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

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

/** Same walk `tests/ward-cancel-transport-stage.test.ts` uses: pulled, then a transport job booked
 *  on top, with the movement left at stage "pulled" (booking never advances stage). */
function pulledAndBookedMovement(movementId = CAPACITY_MOVEMENT, unitId = CAPACITY_UNIT) {
  let state = withRoom(seedWardFlowState(), unitId);
  for (const step of [
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

describe("RECORD_TRANSPORT_NEED refuses to override a live booked job (audit 2026-09-25 §3 item 4a)", () => {
  it("refuses needed:false while the job is booked and neither cancelled nor arrived", () => {
    const { state: booked, movementId } = pulledAndBookedMovement();

    const recorded = wardFlowReducer(booked, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      now: NOW + 2,
      movementId,
      needed: false,
    });

    expect(recorded.rejections.length).toBeGreaterThan(booked.rejections.length);
    expect(recorded.rejections.at(-1)?.reason).toMatch(
      /has a booked transport job; cancel it before recording that no transport is needed/,
    );
    // Nothing was written onto the live job.
    expect(movement(recorded, movementId).transportNeed).toBeUndefined();
    expect(movement(recorded, movementId).transport?.needed).toBeUndefined();
  });

  it("still allows needed:false once the booked job is cancelled", () => {
    const { state: booked, movementId } = pulledAndBookedMovement();
    const cancelled = wardFlowReducer(booked, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: NOW + 2,
      movementId,
      reason: CANCEL_TRANSPORT_REASONS[0],
    });
    expect(cancelled.rejections, "CANCEL_TRANSPORT was itself refused").toEqual(booked.rejections);
    // CANCEL_TRANSPORT removes the job outright rather than stamping `cancelledAt` on it (see
    // `TransportJob.cancelledAt`'s own doc comment) — so "no live job" here is `transport` absent.
    expect(movement(cancelled, movementId).transport).toBeUndefined();

    const recorded = wardFlowReducer(cancelled, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      now: NOW + 3,
      movementId,
      needed: false,
    });
    expect(recorded.rejections, "RECORD_TRANSPORT_NEED was refused after a legitimate cancellation").toEqual(
      cancelled.rejections,
    );
    expect(movement(recorded, movementId).transportNeed).toEqual({ needed: false, at: NOW + 3 });
  });

  it("still allows re-recording needed:true (or re-recording after arrival/collection) without the new refusal firing", () => {
    const { state: booked, movementId } = pulledAndBookedMovement();
    const recorded = wardFlowReducer(booked, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      now: NOW + 2,
      movementId,
      needed: true,
    });
    expect(recorded.rejections, "needed:true must never be refused by the booked-job guard").toEqual(
      booked.rejections,
    );
  });
});

describe("PATIENT_ARRIVED's no-transport-needed route requires no live job (audit 2026-09-25 §3 item 4b)", () => {
  it("refuses arrival via the no-transport-needed route while an uncollected booked job is still live", () => {
    const { state: booked, movementId, unitId } = pulledAndBookedMovement();
    // Staff record "not needed" is impossible while the job is live (item 4a above), so reach the
    // same shape directly on the movement to prove PATIENT_ARRIVED's own guard independently of
    // RECORD_TRANSPORT_NEED's refusal.
    const withStaleNeed: WardFlowState = {
      ...booked,
      movements: booked.movements.map((candidate) =>
        candidate.id === movementId ? { ...candidate, transportNeed: { needed: false, at: NOW + 2 } } : candidate,
      ),
    };

    const arrived = wardFlowReducer(withStaleNeed, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW + 3,
      movementId,
      actingUnitId: unitId,
    });

    // The live job means the ordinary chain (handover, en route, collection) still applies —
    // arriving straight from "pulled" is refused exactly as for any other booked-but-uncollected job.
    expect(arrived.rejections.length).toBeGreaterThan(withStaleNeed.rejections.length);
    expect(arrived.rejections.at(-1)?.reason).toMatch(/cannot arrive a patient at the movement's current stage/);
  });

  it("once the booked job is genuinely cancelled (transport removed), arrival proceeds with no job to write onto", () => {
    const { state: booked, movementId, unitId } = pulledAndBookedMovement();
    const cancelled = wardFlowReducer(booked, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: NOW + 2,
      movementId,
      reason: CANCEL_TRANSPORT_REASONS[0],
    });
    expect(cancelled.rejections).toEqual(booked.rejections);
    const recorded = wardFlowReducer(cancelled, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      now: NOW + 3,
      movementId,
      needed: false,
    });
    expect(recorded.rejections).toEqual(cancelled.rejections);
    expect(movement(recorded, movementId).stage, "cancelling and re-recording must leave the movement pulled").toBe(
      "pulled",
    );

    const arrived = wardFlowReducer(recorded, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW + 4,
      movementId,
      actingUnitId: unitId,
    });

    expect(arrived.rejections, `PATIENT_ARRIVED was refused: ${arrived.rejections.at(-1)?.reason}`).toEqual(
      recorded.rejections,
    );
    const moved = movement(arrived, movementId);
    expect(moved.closure?.outcome).toBe("arrived");
    expect(moved.closure?.reason).toBe("Patient arrived at the accepting unit (no transport needed)");
    // No job survives to write onto — CANCEL_TRANSPORT removed it outright.
    expect(moved.transport).toBeUndefined();
  });

  /**
   * `TransportJob.cancelledAt`'s own doc comment states the invariant every reducer-reachable path
   * follows: `cancelledAt` is written only together with `movement.closure`, in the same update, so
   * a *closed* movement can carry a job with `cancelledAt` set, but an *open* one never can via the
   * reducer alone. This is therefore a hand-authored, reducer-unreachable shape — the same
   * discipline `tests/ward-flow-recovery.dom.test.tsx` uses for malformed states — that exercises
   * the defensive half of the fix directly: IF a live-looking movement ever did carry a job already
   * marked `cancelledAt`, arrival via the no-transport-needed route must still never write
   * `arrivedAt` onto it.
   */
  it("defensively never writes arrivedAt onto a job already marked cancelledAt, even on a hand-authored state", () => {
    const { state: booked, movementId, unitId } = pulledAndBookedMovement();
    const staleCancelled: WardFlowState = {
      ...booked,
      movements: booked.movements.map((candidate) =>
        candidate.id === movementId
          ? {
              ...candidate,
              transportNeed: { needed: false, at: NOW + 2 },
              transport: candidate.transport ? { ...candidate.transport, cancelledAt: NOW + 2 } : candidate.transport,
            }
          : candidate,
      ),
    };
    expect(movement(staleCancelled, movementId).transport?.cancelledAt).toBe(NOW + 2);

    const arrived = wardFlowReducer(staleCancelled, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW + 4,
      movementId,
      actingUnitId: unitId,
    });

    expect(arrived.rejections, `PATIENT_ARRIVED was refused: ${arrived.rejections.at(-1)?.reason}`).toEqual(
      staleCancelled.rejections,
    );
    const moved = movement(arrived, movementId);
    expect(moved.closure?.outcome).toBe("arrived");
    // The already-cancelled job survives untouched — no arrivedAt written onto it via this route.
    expect(moved.transport?.cancelledAt).toBe(NOW + 2);
    expect(moved.transport?.arrivedAt).toBeUndefined();
  });
});
