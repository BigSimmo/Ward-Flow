import { describe, expect, it } from "vitest";

import { STOP_TRANSPORT_REASONS, TRANSPORT_WHEREABOUTS } from "../src/components/ward-management/ward-change-reasons";
import {
  STAGE_TRANSITION_BLOCKERS,
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/**
 * 🔴 WLQ-38 (owner, 2026-09-15), verbatim: *"This should also be the referring doctors
 * responsibility as well to be able to revoke the transport as well as referral in addition to the
 * coordinator."*
 *
 * `CANCEL_TRANSPORT` refuses once `transport.collectedAt` is set — "the patient has departed" —
 * and until `STOP_TRANSPORT` existed nothing else could stop a journey already under way. This
 * event closes that gap: the referrer (`ed`) or the coordinator may stop a COLLECTED transport,
 * before the patient arrives, on one of three fixed reasons.
 */

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

/** A live, unaccepted referral at a unit with room to pull — see the identical helper and its own
 *  doc comment in `tests/ward-withdraw-referral.test.ts` for why capacity must be found rather than
 *  assumed from `anOpenReferral`'s first match alone. */
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

/** Accepts (with an override, so a stale capacity-freshness gate cannot make this flaky), pulls,
 *  books transport and reaches `handover_ready` — the last stage before collection. */
function readyForHandover(state: WardFlowState) {
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
  const booked = wardFlowReducer(pulled, {
    type: "BOOK_TRANSPORT",
    role: "ed",
    now: NOW + 2,
    movementId: open.id,
    provider: "Ambulance service",
    escortRequired: false,
    cadNumber: "CAD-STUB-0001",
    transportLegalStatus: "voluntary",
    estimatedAt: 0,
  });
  expect(booked.rejections, "BOOK_TRANSPORT was itself refused, so nothing below holds").toHaveLength(0);
  const ready = wardFlowReducer(booked, { type: "HANDOVER_READY", role: "ed", now: NOW + 3, movementId: open.id });
  expect(ready.rejections, "HANDOVER_READY was itself refused, so nothing below holds").toHaveLength(0);
  return { state: ready, movementId: open.id, unitId };
}

/** `readyForHandover`, then driven through the transport chain to collection. */
function collected(state: WardFlowState) {
  const { state: ready, movementId, unitId } = readyForHandover(state);
  const accepted = wardFlowReducer(ready, { type: "TRANSPORT_ACCEPTED", role: "officer", now: NOW + 4, movementId });
  expect(accepted.rejections, "TRANSPORT_ACCEPTED was itself refused, so nothing below holds").toHaveLength(0);
  const enRoute = wardFlowReducer(accepted, { type: "TRANSPORT_EN_ROUTE", role: "officer", now: NOW + 5, movementId });
  expect(enRoute.rejections, "TRANSPORT_EN_ROUTE was itself refused, so nothing below holds").toHaveLength(0);
  const patientCollected = wardFlowReducer(enRoute, {
    type: "PATIENT_COLLECTED",
    role: "officer",
    now: NOW + 6,
    movementId,
  });
  expect(patientCollected.rejections, "PATIENT_COLLECTED was itself refused, so nothing below holds").toHaveLength(0);
  return { state: patientCollected, movementId, unitId };
}

/** `collected`, with the WLQ-4 blocker `examinationRevokedAwaitingRelease` standing, reached by a
 *  real `RECORD_EXAMINATION(outcome: "revoked")` dispatched AFTER collection, at stage `moving` —
 *  WLQ-4's own documented shape: it flags the movement and leaves it open rather than closing it.
 *
 *  🔴 T9, owner answer 5 (second round, 2026-09-17): `PATIENT_COLLECTED` now refuses outright while
 *  a revoked/community-order examination still holds this movement's bed (the exact gap
 *  `RECORD_EXAMINATION`'s own case comment used to report rather than fix — see its "NOT COVERED
 *  HERE" note). So the revoke can no longer happen BEFORE collection and still let collection
 *  through; this helper revokes the examination once the patient is already collected instead,
 *  which is still a real, reachable path to the same blocker (`RECORD_EXAMINATION` stays valid at
 *  `moving`, per its own `transportAlreadyCommitted` branch) and still proves the stop-hold
 *  behaviour this file exists for. */
function collectedWithRevokedExamination(state: WardFlowState) {
  const { state: patientCollected, movementId, unitId } = collected(state);
  const revoked = wardFlowReducer(patientCollected, {
    type: "RECORD_EXAMINATION",
    role: "ed",
    now: NOW + 7,
    movementId,
    outcome: "revoked",
  });
  expect(revoked.rejections, "RECORD_EXAMINATION was itself refused, so nothing below holds").toHaveLength(0);
  expect(
    movement(revoked, movementId).blocker,
    "PRECONDITION: the WLQ-4 blocker must actually be standing, or clearing it proves nothing",
  ).toBe(STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease);

  return { state: revoked, movementId, unitId };
}

describe("stopping a collected transport — WLQ-38 (owner, 2026-09-15)", () => {
  describe.each(["ed", "coordinator"] as const)("%s stops a collected journey", (role) => {
    it(
      'stops with "The examination was revoked": the bed stays held (owner answer 8), ' +
        "movement closed, the WLQ-4 blocker replaced by the stop-hold blocker, ward notified, " +
        "and arrival refused afterwards",
      () => {
        const { state: withBlocker, movementId, unitId } = collectedWithRevokedExamination(seedWardFlowState());
        const unitBefore = withBlocker.units.find((candidate) => candidate.id === unitId)!;
        const admissionsAfterPull = withBlocker.admissions.length;
        const admissionIdBefore = movement(withBlocker, movementId).admissionId;

        const stopped = wardFlowReducer(withBlocker, {
          type: "STOP_TRANSPORT",
          role,
          now: NOW + 8,
          movementId,
          reason: "The examination was revoked",
          whereabouts: "At another emergency department",
        });

        expect(stopped.rejections, `${role} was refused: ${stopped.rejections.at(-1)?.reason}`).toHaveLength(0);
        const after = movement(stopped, movementId);
        const unitAfter = stopped.units.find((candidate) => candidate.id === unitId)!;

        // Owner answer 8 (second round, 2026-09-17): the bed is NOT refunded and the admission is
        // NOT deleted — it stays held until the coordinator, the ward or the referrer releases it.
        expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value);
        expect(stopped.admissions.length).toBe(admissionsAfterPull);
        expect(after.admissionId).toBe(admissionIdBefore);
        expect(after.admissionId).toBeDefined();
        // Movement closed.
        expect(after.closure?.outcome).toBe("did_not_proceed");
        expect(after.closure?.reason).toBe("The examination was revoked");
        expect(after.closure?.at).toBe(NOW + 8);
        // The WLQ-4 blocker is replaced by the newer, more specific "stop held the bed" sentence —
        // an ACTIVE blocker, not "None — …", because a release decision is still outstanding.
        expect(after.blocker).toBe(STAGE_TRANSITION_BLOCKERS.transportStoppedAwaitingRelease);
        expect(after.blocker).not.toBe(STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease);
        expect(after.blocker).not.toBe(STAGE_TRANSITION_BLOCKERS.didNotProceed);
        // The transport job records who stopped it, when, why, and where the patient is, and is
        // also cancelled.
        expect(after.transport?.stoppedAt).toBe(NOW + 8);
        expect(after.transport?.stoppedBy).toBe(role);
        expect(after.transport?.stopReason).toBe("The examination was revoked");
        expect(after.transport?.stoppedWhereabouts).toBe("At another emergency department");
        expect(after.transport?.cancelledAt).toBe(NOW + 8);
        // The receiving ward is notified.
        const notice = stopped.notices.find((candidate) => candidate.kind === "transport_stopped_ward");
        expect(notice, "no notice reached the receiving ward").toBeDefined();
        expect(notice?.to).toEqual({ role: "ward", placeId: unitId });
        expect(notice?.about.movementId).toBe(movementId);
        // T3 (item 31): the officer is told the place too, unconditionally — unlike the ward
        // notice above, this does not depend on an accepted unit existing.
        const officerNotice = stopped.notices.find((candidate) => candidate.kind === "transport_stopped_officer");
        expect(officerNotice, "no notice reached the officer").toBeDefined();
        expect(officerNotice?.to).toEqual({ role: "officer" });
        expect(officerNotice?.about.movementId).toBe(movementId);
        expect(officerNotice?.sentence).toBe(
          `Transport for ${movementId} was stopped (The examination was revoked). Where the patient is now: At another emergency department.`,
        );

        // PATIENT_ARRIVED is refused afterwards — closure alone does this (TransportJob's own doc
        // comment on `arrivedAt`/`cancelledAt`), proven rather than assumed.
        const arrived = wardFlowReducer(stopped, {
          type: "PATIENT_ARRIVED",
          role: "officer",
          now: NOW + 9,
          movementId,
        });
        expect(arrived.rejections.length).toBeGreaterThan(stopped.rejections.length);
        expect(movement(arrived, movementId).stage).not.toBe("arrived");
      },
    );
  });

  it("refuses a ward", () => {
    const { state: withBlocker, movementId } = collectedWithRevokedExamination(seedWardFlowState());
    const next = wardFlowReducer(withBlocker, {
      type: "STOP_TRANSPORT",
      role: "ward",
      now: NOW + 8,
      movementId,
      reason: "The examination was revoked",
      whereabouts: TRANSPORT_WHEREABOUTS[0],
    });
    expect(next.rejections.length).toBeGreaterThan(withBlocker.rejections.length);
    expect(movement(next, movementId).closure).toBeUndefined();
  });

  it("refuses a reason that is not in STOP_TRANSPORT_REASONS", () => {
    const { state: withCollected, movementId } = collected(seedWardFlowState());
    const before = withCollected.rejections.length;
    const next = wardFlowReducer(withCollected, {
      // A cast, as any JavaScript caller could send — the same discipline every other
      // reason-carrying event in this codebase's tests uses (see e.g. `RELEASE_PULL`'s own
      // off-list-reason test in `ward-flow-reducer.test.ts`).
      type: "STOP_TRANSPORT",
      role: "ed",
      now: NOW + 7,
      movementId,
      reason: "the patient improved" as (typeof STOP_TRANSPORT_REASONS)[number],
      whereabouts: TRANSPORT_WHEREABOUTS[0],
    });
    expect(next.rejections.length).toBeGreaterThan(before);
    expect(next.rejections.at(-1)?.reason).toMatch(/STOP_TRANSPORT_REASONS/);
    expect(movement(next, movementId).closure).toBeUndefined();
  });

  it("refuses a whereabouts that is not in TRANSPORT_WHEREABOUTS", () => {
    const { state: withCollected, movementId } = collected(seedWardFlowState());
    const before = withCollected.rejections.length;
    const next = wardFlowReducer(withCollected, {
      // A cast, as any JavaScript caller could send — the same discipline the reason test above
      // uses.
      type: "STOP_TRANSPORT",
      role: "ed",
      now: NOW + 7,
      movementId,
      reason: STOP_TRANSPORT_REASONS[0],
      whereabouts: "somewhere unlisted" as (typeof TRANSPORT_WHEREABOUTS)[number],
    });
    expect(next.rejections.length).toBeGreaterThan(before);
    expect(next.rejections.at(-1)?.reason).toMatch(/TRANSPORT_WHEREABOUTS/);
    expect(movement(next, movementId).closure).toBeUndefined();
  });

  it("refuses a transport that has not been collected yet — CANCEL_TRANSPORT is still the event for that", () => {
    const { state: ready, movementId } = readyForHandover(seedWardFlowState());

    const stopped = wardFlowReducer(ready, {
      type: "STOP_TRANSPORT",
      role: "ed",
      now: NOW + 4,
      movementId,
      reason: "The referral was withdrawn",
      whereabouts: TRANSPORT_WHEREABOUTS[0],
    });
    expect(stopped.rejections.length).toBeGreaterThan(ready.rejections.length);
    expect(stopped.rejections.at(-1)?.reason).toMatch(/CANCEL_TRANSPORT/);
    expect(movement(stopped, movementId).closure).toBeUndefined();

    // Positive control — CANCEL_TRANSPORT genuinely still works at this stage, so the refusal
    // above is about STOP_TRANSPORT's own precondition and not some unrelated breakage.
    const cancelled = wardFlowReducer(ready, {
      type: "CANCEL_TRANSPORT",
      role: "ed",
      now: NOW + 4,
      movementId,
      reason: "provider_unavailable",
    });
    expect(cancelled.rejections, `CANCEL_TRANSPORT was refused: ${cancelled.rejections.at(-1)?.reason}`).toHaveLength(
      0,
    );
  });

  it("refuses an arrived (closed) movement", () => {
    const { state: withCollected, movementId } = collected(seedWardFlowState());
    const arrived = wardFlowReducer(withCollected, {
      type: "PATIENT_ARRIVED",
      role: "officer",
      now: NOW + 7,
      movementId,
    });
    expect(arrived.rejections, "PATIENT_ARRIVED was itself refused, so nothing below holds").toHaveLength(0);
    expect(movement(arrived, movementId).closure?.outcome).toBe("arrived");

    const stopped = wardFlowReducer(arrived, {
      type: "STOP_TRANSPORT",
      role: "ed",
      now: NOW + 8,
      movementId,
      reason: "The examination was revoked",
      whereabouts: TRANSPORT_WHEREABOUTS[0],
    });
    expect(stopped.rejections.length).toBeGreaterThan(arrived.rejections.length);
    expect(stopped.rejections.at(-1)?.reason).toMatch(/closed movement/);
  });

  it("refuses an unknown movement", () => {
    const state = seedWardFlowState();
    const next = wardFlowReducer(state, {
      type: "STOP_TRANSPORT",
      role: "ed",
      now: NOW,
      movementId: "MV-NOT-A-REAL-ONE",
      reason: "The examination was revoked",
      whereabouts: TRANSPORT_WHEREABOUTS[0],
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toMatch(/no movement found/i);
    expect(next.movements).toEqual(state.movements);
  });
});

describe("releasing a bed STOP_TRANSPORT left held — owner answer 8 (second round, 2026-09-17)", () => {
  function stoppedWithHeldBed(state: WardFlowState) {
    const { state: withBlocker, movementId, unitId } = collectedWithRevokedExamination(state);
    const stopped = wardFlowReducer(withBlocker, {
      type: "STOP_TRANSPORT",
      role: "coordinator",
      now: NOW + 8,
      movementId,
      reason: "The examination was revoked",
      whereabouts: TRANSPORT_WHEREABOUTS[0],
    });
    expect(stopped.rejections, "STOP_TRANSPORT was itself refused, so nothing below holds").toHaveLength(0);
    return { state: stopped, movementId, unitId };
  }

  describe.each(["coordinator", "ed"] as const)("%s releases it", (role) => {
    it("gives the bed back exactly once and clears the blocker", () => {
      const { state: held, movementId, unitId } = stoppedWithHeldBed(seedWardFlowState());
      const unitBefore = held.units.find((candidate) => candidate.id === unitId)!;
      const admissionsBefore = held.admissions.length;

      const released = wardFlowReducer(held, {
        type: "RELEASE_HELD_BED",
        role,
        now: NOW + 9,
        movementId,
      });

      expect(released.rejections, `${role} was refused: ${released.rejections.at(-1)?.reason}`).toHaveLength(0);
      const after = movement(released, movementId);
      const unitAfter = released.units.find((candidate) => candidate.id === unitId)!;
      expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value + 1);
      expect(released.admissions.length).toBe(admissionsBefore - 1);
      expect(after.admissionId).toBeUndefined();
      expect(after.blocker).toBe(STAGE_TRANSITION_BLOCKERS.didNotProceed);
      // The closure itself is untouched — the journey ended when it was stopped, not now.
      expect(after.closure?.outcome).toBe("did_not_proceed");
    });
  });

  it("lets the accepting ward release it when it states its own unit", () => {
    const { state: held, movementId, unitId } = stoppedWithHeldBed(seedWardFlowState());
    const released = wardFlowReducer(held, {
      type: "RELEASE_HELD_BED",
      role: "ward",
      now: NOW + 9,
      movementId,
      actingUnitId: unitId,
    });
    expect(released.rejections, `ward was refused: ${released.rejections.at(-1)?.reason}`).toHaveLength(0);
    expect(movement(released, movementId).admissionId).toBeUndefined();
  });

  it("refuses a different ward stating someone else's unit", () => {
    const { state: held, movementId } = stoppedWithHeldBed(seedWardFlowState());
    const before = held.rejections.length;
    const next = wardFlowReducer(held, {
      type: "RELEASE_HELD_BED",
      role: "ward",
      now: NOW + 9,
      movementId,
      actingUnitId: "WD-NOT-THE-RIGHT-ONE",
    });
    expect(next.rejections.length).toBeGreaterThan(before);
    expect(next.rejections.at(-1)?.reason).toMatch(/bed is held at/);
  });

  it("refuses a movement STOP_TRANSPORT never touched", () => {
    const state = seedWardFlowState();
    const { movementId } = collected(state);
    const before = state.rejections.length;
    const next = wardFlowReducer(state, {
      type: "RELEASE_HELD_BED",
      role: "coordinator",
      now: NOW + 9,
      movementId,
    });
    expect(next.rejections.length).toBeGreaterThan(before);
    expect(next.rejections.at(-1)?.reason).toMatch(/was not stopped by STOP_TRANSPORT/);
  });

  it("refuses a second release", () => {
    const { state: held, movementId } = stoppedWithHeldBed(seedWardFlowState());
    const released = wardFlowReducer(held, {
      type: "RELEASE_HELD_BED",
      role: "coordinator",
      now: NOW + 9,
      movementId,
    });
    expect(released.rejections, "first release was itself refused, so nothing below holds").toHaveLength(0);
    const twice = wardFlowReducer(released, {
      type: "RELEASE_HELD_BED",
      role: "coordinator",
      now: NOW + 10,
      movementId,
    });
    expect(twice.rejections.length).toBeGreaterThan(released.rejections.length);
    expect(twice.rejections.at(-1)?.reason).toMatch(/holds no bed — it may already have been released/);
  });
});
