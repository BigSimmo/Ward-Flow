import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/**
 * OWNER ANSWER 10 (second round, 2026-09-17), verbatim recommendation accepted: *"'No transport
 * needed' is recorded at pull, booking is skipped, and the ward records the arrival."* Before this,
 * `PATIENT_ARRIVED` unconditionally required stage `"moving"` and `transport.collectedAt` — a
 * patient walked across site by staff, or brought in by family, had no way to ever be recorded as
 * arrived without first fabricating a transport job nobody actually used.
 */

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

/** A live, unaccepted referral at a unit with room to pull. Mirrors the identical helper in
 *  `tests/ward-withdraw-referral.test.ts` and `tests/ward-stop-transport.test.ts`. */
function anOpenReferralWithCapacity(state: WardFlowState) {
  const found = state.movements.find(
    (candidate) =>
      candidate.referredUnitIds.length > 0 &&
      !candidate.acceptedUnitId &&
      !candidate.closure &&
      (state.units.find((unit) => unit.id === candidate.referredUnitIds[0])?.allocatable.value ?? 0) > 0,
  );
  if (!found) throw new Error("the seed contains no live, unaccepted referral at a unit with room to pull");
  return found;
}

/** Accepts and pulls a bed, with no transport job booked — the state a "no transport needed"
 *  arrival starts from. */
function pulledWithCapacity(state: WardFlowState) {
  const open = anOpenReferralWithCapacity(state);
  const unitId = open.referredUnitIds[0]!;
  const accepted = wardFlowReducer(state, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: "ward",
    now: NOW,
    movementId: open.id,
    unitId,
    overrideReason: "The bed information is known to be out of date",
  });
  expect(accepted.rejections, "ACCEPT_IN_PRINCIPLE was itself refused, so nothing below holds").toHaveLength(0);
  const pulled = wardFlowReducer(accepted, {
    type: "PULL_PATIENT",
    role: "ward",
    now: NOW + 1,
    movementId: open.id,
    unitId,
  });
  expect(pulled.rejections, "PULL_PATIENT was itself refused, so nothing below holds").toHaveLength(0);
  return { state: pulled, movementId: open.id, unitId };
}

describe('"No transport needed" — owner answer 10 (second round, 2026-09-17)', () => {
  it("lets the ward record arrival directly once transport is recorded as not needed, with no transport job", () => {
    const { state: pulled, movementId, unitId } = pulledWithCapacity(seedWardFlowState());
    const unitBeforeArrival = pulled.units.find((candidate) => candidate.id === unitId)!;

    const recorded = wardFlowReducer(pulled, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      now: NOW + 2,
      movementId,
      needed: false,
    });
    expect(recorded.rejections, "RECORD_TRANSPORT_NEED was itself refused, so nothing below holds").toHaveLength(0);
    expect(movement(recorded, movementId).transport).toBeUndefined();

    const arrived = wardFlowReducer(recorded, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW + 3,
      movementId,
      actingUnitId: unitId,
    });

    expect(arrived.rejections, `PATIENT_ARRIVED was refused: ${arrived.rejections.at(-1)?.reason}`).toHaveLength(0);
    const after = movement(arrived, movementId);
    expect(after.stage).toBe("arrived");
    // No transport job was ever created — none is invented by arriving.
    expect(after.transport).toBeUndefined();
    expect(after.closure?.outcome).toBe("arrived");
    expect(after.closure?.reason).toBe("Patient arrived at the accepting unit (no transport needed)");
    // The bed is genuinely occupied, exactly as the ordinary transport-collected path leaves it.
    const unitAfter = arrived.units.find((candidate) => candidate.id === unitId)!;
    expect(unitAfter.empty.value).toBe(unitBeforeArrival.empty.value - 1);
  });

  it("refuses arrival with no transport needed before the bed is pulled", () => {
    const open = anOpenReferralWithCapacity(seedWardFlowState());
    const unitId = open.referredUnitIds[0]!;
    const accepted = wardFlowReducer(seedWardFlowState(), {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: open.id,
      unitId,
      overrideReason: "The bed information is known to be out of date",
    });
    expect(accepted.rejections, "ACCEPT_IN_PRINCIPLE was itself refused, so nothing below holds").toHaveLength(0);
    const recorded = wardFlowReducer(accepted, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      now: NOW + 1,
      movementId: open.id,
      needed: false,
    });
    expect(recorded.rejections, "RECORD_TRANSPORT_NEED was itself refused, so nothing below holds").toHaveLength(0);

    const arrived = wardFlowReducer(recorded, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW + 2,
      movementId: open.id,
      actingUnitId: unitId,
    });
    expect(arrived.rejections.length).toBeGreaterThan(recorded.rejections.length);
    expect(arrived.rejections.at(-1)?.reason).toMatch(/the bed must be pulled first/);
  });

  it("still refuses arrival with no transport job when transport need was never recorded as false", () => {
    const { state: pulled, movementId, unitId } = pulledWithCapacity(seedWardFlowState());
    const arrived = wardFlowReducer(pulled, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW + 2,
      movementId,
      actingUnitId: unitId,
    });
    expect(arrived.rejections.length).toBeGreaterThan(pulled.rejections.length);
    expect(arrived.rejections.at(-1)?.reason).toMatch(/cannot arrive a patient at the movement's current stage/);
  });

  it("keeps requiring the ordinary transport chain once a job has actually been booked, even with needed: false recorded", () => {
    const { state: pulled, movementId, unitId } = pulledWithCapacity(seedWardFlowState());
    const recorded = wardFlowReducer(pulled, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      now: NOW + 2,
      movementId,
      needed: false,
    });
    expect(recorded.rejections, "RECORD_TRANSPORT_NEED was itself refused, so nothing below holds").toHaveLength(0);
    // Staff change their mind and book anyway — an override they remain free to make.
    const booked = wardFlowReducer(recorded, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW + 3,
      movementId,
      provider: "Ambulance service",
      escortRequired: false,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    expect(booked.rejections, "BOOK_TRANSPORT was itself refused, so nothing below holds").toHaveLength(0);

    const arrived = wardFlowReducer(booked, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW + 4,
      movementId,
      actingUnitId: unitId,
    });
    // A job now exists, so `noTransportNeeded` no longer applies — the ordinary chain (handover,
    // collection) is still required, and arriving straight from here is refused exactly as before.
    expect(arrived.rejections.length).toBeGreaterThan(booked.rejections.length);
    expect(arrived.rejections.at(-1)?.reason).toMatch(/cannot arrive a patient at the movement's current stage/);
  });
});
