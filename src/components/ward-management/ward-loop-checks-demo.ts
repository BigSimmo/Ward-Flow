import type { Instant } from "./ward-clock";
import type { Movement, Unit } from "./ward-model";

/**
 * CLOSING THE LOOP, PACKAGE D (24 Oct 2026): synthetic demo marks, so each record is visible in the
 * standard demo. Every figure here is invented for the demonstration. Records that are missing from
 * the seed are left alone, so a changed fixture never breaks the seed.
 *
 * - WF-008, which did not proceed, has two of its four cancelled-move checks marked.
 * - WF-003 was accepted with two conditions, one met; WF-023 with a "bed after" time.
 * - Graylands Adult Secure has an intake limit with a review due later today.
 * - Graylands Older Adult is closed for staffing with an overdue review, so its transition list
 *   shows what still points at it.
 */
const CANCELLED_MOVEMENT_ID = "WF-008";
const CONDITIONS_MOVEMENT_ID = "WF-003";
const BED_AFTER_MOVEMENT_ID = "WF-023";
const LIMITED_UNIT_ID = "gry-adult-secure";
const CLOSED_UNIT_ID = "gry-older-adult";

const COORDINATOR = "Flow coordinator";
const WARD = "Ward manager";

export function applyLoopChecksDemoOverlay<T extends { movements: Movement[]; units: Unit[] }>(
  state: T,
  now: Instant,
): T {
  const movements = state.movements.map((movement): Movement => {
    if (movement.id === CANCELLED_MOVEMENT_ID && movement.closure?.outcome === "did_not_proceed") {
      const at = movement.closure.at;
      return {
        ...movement,
        cancellationChecks: [
          { item: "receiving_notice", mark: "addressed", at: at + 10, by: COORDINATOR },
          { item: "transport_booking", mark: "not_applicable", at: at + 12, by: COORDINATOR },
        ],
      };
    }
    if (movement.id === CONDITIONS_MOVEMENT_ID && movement.acceptedUnitId !== undefined && !movement.closure) {
      const base = {
        unitId: movement.acceptedUnitId,
        ...(movement.acceptedAt !== undefined ? { acceptedAt: movement.acceptedAt } : {}),
        agreedBy: WARD,
      };
      return {
        ...movement,
        acceptanceConditions: [
          { ...base, kind: "after_medical_clearance", agreedWith: "ed", recordedAt: now - 40 },
          {
            ...base,
            kind: "escort_required",
            agreedWith: "coordinator",
            recordedAt: now - 40,
            met: { at: now - 15, by: COORDINATOR },
          },
        ],
      };
    }
    if (movement.id === BED_AFTER_MOVEMENT_ID && movement.acceptedUnitId !== undefined && !movement.closure) {
      return {
        ...movement,
        acceptanceConditions: [
          {
            kind: "bed_after_time",
            unitId: movement.acceptedUnitId,
            ...(movement.acceptedAt !== undefined ? { acceptedAt: movement.acceptedAt } : {}),
            agreedWith: "coordinator",
            agreedBy: WARD,
            recordedAt: now - 25,
            readyAt: now + 150,
          },
        ],
      };
    }
    return movement;
  });

  const units = state.units.map((unit): Unit => {
    if (unit.id === LIMITED_UNIT_ID && (unit.intakeConstraints ?? []).length === 0) {
      return {
        ...unit,
        intakeConstraints: ["staffing_shortage"],
        restrictionReviews: [
          {
            restriction: "intake_constraints",
            reviewer: "nurse_unit_manager",
            expectedAt: now + 240,
            recordedAt: now - 90,
            by: WARD,
          },
        ],
      };
    }
    if (unit.id === CLOSED_UNIT_ID && !unit.isClosed) {
      const closedAt = now - 180;
      return {
        ...unit,
        isClosed: true,
        admissionsClosure: { reason: "staffing", at: closedAt, by: COORDINATOR },
        restrictionReviews: [
          {
            restriction: "admissions_closure",
            reviewer: "site_bed_manager",
            expectedAt: now - 30,
            recordedAt: closedAt,
            by: COORDINATOR,
            startedAt: closedAt,
          },
        ],
      };
    }
    return unit;
  });

  return { ...state, movements, units };
}
