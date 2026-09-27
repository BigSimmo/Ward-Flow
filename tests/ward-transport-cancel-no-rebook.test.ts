// tests/ward-transport-cancel-no-rebook.test.ts
//
// Owner answer 30 (2026-09-17), build plan `2026-09-17-build-plan-referrals-transport.md` item 30,
// task T1: "Cancelling transport while a bed is held: no automatic rebooking; a person books
// again." Community's own half of T1 (owner answer 24 — which team may cancel) is still an open
// owner question and is deliberately NOT built here; see `tests/ward-transport-cancel-permission.test.ts`
// for the standing comment recording that gap. This file owns only the no-rebooking half.
//
// Before this change, `CANCEL_TRANSPORT` installed a fresh `-replacement-N` job whenever a bed was
// held (at or after `pulled`) and told the officer and the receiving ward "a replacement is being
// arranged" — a promise the record did not support, because nothing had actually booked one.
// `tests/ward-cancel-transport-no-bed-held.test.ts`'s own "control" test pinned exactly that old
// behaviour at `pulled`; it is rewritten alongside this file. This file adds the `handover_ready`
// case (not previously covered) and proves `BOOK_TRANSPORT` can rebook from both stages afterwards.
import { describe, expect, it } from "vitest";

import { orphanedTransport } from "../src/components/ward-management/ward-derivations";
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

const NOW = NOW_ANCHOR;

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

// Same fixture pairing the sibling stage/no-bed-held test files use: `rph-adult-secure` widened
// for room, `WF-012` already proven to pass this unit's eligibility gates with no override needed.
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
  return { state: booked, movementId, unitId };
}

function handoverReadyAndBookedMovement(movementId = CAPACITY_MOVEMENT, unitId = CAPACITY_UNIT) {
  const { state: booked } = pulledAndBookedMovement(movementId, unitId);
  const ready = wardFlowReducer(booked, { type: "HANDOVER_READY", role: "ed", now: NOW + 1, movementId });
  expect(ready.rejections, "the fixture's own walk to handover ready was refused").toEqual([]);
  expect(movement(ready, movementId).stage).toBe("handover_ready");
  return { state: ready, movementId, unitId };
}

function cancel(state: WardFlowState, movementId: string, now: number) {
  return wardFlowReducer(state, {
    type: "CANCEL_TRANSPORT",
    role: "coordinator",
    now,
    movementId,
    reason: CANCEL_TRANSPORT_REASONS[0],
  });
}

describe("CANCEL_TRANSPORT with a bed held no longer rebooks automatically (owner answer 30)", () => {
  it("at handover_ready: removes the job, keeps the stage, and sets the new blocker", () => {
    const { state: ready, movementId } = handoverReadyAndBookedMovement();
    const originalJobId = movement(ready, movementId).transport!.id;

    const cancelled = cancel(ready, movementId, NOW + 2);
    expect(cancelled.rejections).toEqual([]);
    const after = movement(cancelled, movementId);

    expect(after.transport).toBeUndefined();
    expect(after.stage).toBe("handover_ready");
    expect(after.blocker).toBe("Transport cancelled; not booked again yet");

    const unwind = after.unwinds.at(-1);
    expect(unwind?.kind).toBe("transport_cancelled");
    expect(unwind?.transportId).toBe(originalJobId);
  });

  it("at pulled: sets the same new blocker as the handover_ready case", () => {
    const { state: booked, movementId } = pulledAndBookedMovement();
    const cancelled = cancel(booked, movementId, NOW + 2);
    expect(cancelled.rejections).toEqual([]);
    const after = movement(cancelled, movementId);

    expect(after.transport).toBeUndefined();
    expect(after.stage).toBe("pulled");
    expect(after.blocker).toBe("Transport cancelled; not booked again yet");
  });

  it("neither notice promises a replacement, and both say the bed is still held", () => {
    const { state: ready, movementId } = handoverReadyAndBookedMovement();
    const before = ready.notices.length;
    const cancelled = cancel(ready, movementId, NOW + 2);
    expect(cancelled.rejections).toEqual([]);

    const raised = cancelled.notices.slice(before);
    expect(raised).toHaveLength(2);
    expect(raised.map((notice) => notice.kind).sort()).toEqual(
      ["transport_cancelled_officer", "transport_cancelled_ward"].sort(),
    );
    for (const notice of raised) {
      expect(notice.sentence.toLowerCase()).not.toContain("replacement");
      expect(notice.sentence.toLowerCase()).toContain("the bed is still held and nothing has been rebooked");
    }
  });

  it("the orphan panel stays empty — a bed-held cancel is never mistaken for the no-bed-held orphan", () => {
    const { state: ready, movementId } = handoverReadyAndBookedMovement();
    const cancelled = cancel(ready, movementId, NOW + 2);
    expect(cancelled.rejections).toEqual([]);
    expect(orphanedTransport(movement(cancelled, movementId))).toBeUndefined();
  });

  it("BOOK_TRANSPORT then succeeds again at pulled, with an id distinct from the cancelled job's", () => {
    const { state: booked, movementId } = pulledAndBookedMovement();
    const originalJobId = movement(booked, movementId).transport!.id;
    const cancelled = cancel(booked, movementId, NOW + 2);
    expect(cancelled.rejections).toEqual([]);
    expect(movement(cancelled, movementId).transport).toBeUndefined();

    const rebooked = wardFlowReducer(cancelled, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW + 3,
      movementId,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: false,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    expect(rebooked.rejections, "the rebooking at pulled was refused").toEqual([]);
    const rebookedJob = movement(rebooked, movementId).transport;
    expect(rebookedJob?.id).toBeDefined();
    expect(rebookedJob?.id).not.toBe(originalJobId);
  });

  it("BOOK_TRANSPORT then succeeds again at handover_ready — the stage BOOK_TRANSPORT used to refuse outright", () => {
    const { state: ready, movementId } = handoverReadyAndBookedMovement();
    const originalJobId = movement(ready, movementId).transport!.id;
    const cancelled = cancel(ready, movementId, NOW + 2);
    expect(cancelled.rejections).toEqual([]);
    expect(movement(cancelled, movementId).transport).toBeUndefined();
    expect(movement(cancelled, movementId).stage).toBe("handover_ready");

    const rebooked = wardFlowReducer(cancelled, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW + 3,
      movementId,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: false,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    expect(
      rebooked.rejections,
      "BOOK_TRANSPORT must now work from handover_ready — item 30's whole point is that a person can book again",
    ).toEqual([]);
    const rebookedJob = movement(rebooked, movementId).transport;
    expect(rebookedJob?.id).toBeDefined();
    expect(rebookedJob?.id).not.toBe(originalJobId);
    expect(movement(rebooked, movementId).stage).toBe("handover_ready");
  });

  it("still refuses BOOK_TRANSPORT strictly before pulled — the widening is exactly two stages, not every stage", () => {
    const state = seedWardFlowState();
    const referred = state.movements.find((candidate) => candidate.stage === "accepted_awaiting_bed");
    expect(referred, "the seed must carry a movement at accepted_awaiting_bed, or this proves nothing").toBeDefined();

    const attempted = wardFlowReducer(state, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW,
      movementId: referred!.id,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: false,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    expect(attempted.rejections.length).toBe(1);
    expect(attempted.rejections.at(-1)?.reason).toMatch(/cannot book transport at the movement's current stage/);
  });
});
