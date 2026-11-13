import { pointedAtWard } from "./capacity/ward-closure";
import { closureTransitionItems } from "./loop-checks/ward-loop-checks";
import { bedIsOccupied, type Admission, type PlannedAdmission } from "./ward-admissions";
import type { Instant } from "./ward-clock";
import type { Movement, Referral, Unit } from "./ward-model";
import { boundedBedAvailability } from "./ward-ready-beds";
import { wardStaySeats } from "./ward/ward-bed-layout";
import { adverseExampleWard, incidentExampleWardIds, staffRequestExampleWard } from "./ward-demo-adverse-wards";

/**
 * CLOSING THE LOOP, PACKAGE D (24 Oct 2026): synthetic demo marks, so each record is visible in the
 * standard demo. Every figure here is invented for the demonstration. Records that are missing from
 * the seed are left alone, so a changed fixture never breaks the seed.
 *
 * - WF-008, which did not proceed, has two of its four cancelled-move checks marked.
 * - WF-003 was accepted with two conditions, one met; WF-023 with a "bed after" time.
 * - Graylands Adult Secure has an intake limit with a review due later today.
 * - One ward is closed for staffing with an overdue review, so its transition list
 *   shows what still points at it (A16-17 below).
 * - Item 6 (10 Nov 2026): a ward has its top empty bed closed for staffing four hours ago with a
 *   review time an hour ago, so "Closed beds past review" shows on Capacity and the bed meeting
 *   agenda. It takes one Ready bed, as any closed bed does.
 *
 * A16-17 (D-175 item 1, approved system fix: "no open referral to a closed ward"): the closed ward is
 * one that no open bed request or queued referral is still asking. Closing a ward leaves its
 * acceptances and held beds where they are (`ward-flow-ward-closure-events.ts`), so the ward chosen
 * is one where something accepted still points at it, and its transition list has an item to work
 * through. Graylands Older Adult stays the preference; while an open request asks it, the rule
 * passes it over.
 *
 * No double adverse example (Fixes thread, 13 Nov 2026, under the owner's autonomy ruling): the closed
 * ward is never one that already holds, or is about to be given, another adverse example, such as
 * the seeded staff request (RPH Older Adult) or an example incident. On the Standard day that lands
 * the closure on SCGH Older Adult. If no ward meets every preference, A16-17 is kept first, then
 * this rule, then the preference for a ward something accepted still points at.
 *
 * A15-27 (Josh, 13 Nov 2026): the three ward records are adverse examples, so each lands only on a
 * ward the shared rule allows (`adverseExampleWard`, `ward-demo-adverse-wards.ts`). The typed ids
 * are preferences; a ward carrying a real ward's own name (Maali, which the closed bed used to name)
 * is passed over for the first generic-label ward that suits the record.
 */
const CANCELLED_MOVEMENT_ID = "WF-008";
const CONDITIONS_MOVEMENT_ID = "WF-003";
const BED_AFTER_MOVEMENT_ID = "WF-023";
const LIMITED_UNIT_ID = "gry-adult-secure";
const CLOSED_UNIT_ID = "gry-older-adult";
/**
 * A generic-label ward (A15-27), named so the closed bed does not fall through to the first ward
 * that fits: that is FSH Adult Secure, the bed-move fixture whose tests need a free open bed.
 */
const CLOSED_BED_UNIT_ID = "bty-adult-secure";

const COORDINATOR = "Bed coordinator";
const WARD = "Ward manager";

/**
 * The highest bed on the ward with no stay in it and none held, while the ward keeps another Ready
 * bed; `undefined` leaves the ward alone, so a changed fixture never breaks the seed.
 */
function demoClosedBed(unit: Unit, movements: readonly Movement[], admissions: readonly Admission[]) {
  if (unit.isClosed || (unit.closedBeds ?? []).length > 0 || boundedBedAvailability(unit).available < 2) return;
  const seats = wardStaySeats(unit, admissions);
  const taken = new Set<number>();
  for (const stay of admissions) {
    if (stay.unitId !== unit.id || !bedIsOccupied(stay)) continue;
    const bed = stay.bedNumber ?? seats.get(stay.id);
    if (bed !== undefined) taken.add(bed);
  }
  for (const movement of movements) {
    if (!movement.closure && movement.acceptedUnitId === unit.id && movement.heldBedNumber !== undefined) {
      taken.add(movement.heldBedNumber);
    }
  }
  for (let bed = unit.beds; bed >= 1; bed -= 1) if (!taken.has(bed)) return bed;
  return undefined;
}

/**
 * The wards that already hold, or will be given by the example lists, another adverse example: an
 * intake limit, a closed bed or an incident already recorded, the seeded staff request, or an
 * example incident (`ward-demo-adverse-wards.ts`). The closed ward keeps off them, so no ward
 * carries two invented adverse records at once.
 */
function otherAdverseExampleWardIds(units: readonly Unit[]): Set<string> {
  const ids = incidentExampleWardIds(units);
  const staffWard = staffRequestExampleWard(units);
  if (staffWard) ids.add(staffWard.id);
  for (const unit of units) {
    if (
      (unit.intakeConstraints ?? []).length > 0 ||
      (unit.closedBeds ?? []).length > 0 ||
      (unit.restrictivePractice?.incidents ?? []).length > 0
    )
      ids.add(unit.id);
  }
  return ids;
}

/** A16-17: true when an open bed request or a queued referral is still waiting on this ward's answer. */
function asksWaitingOn(unitId: string, movements: readonly Movement[], referrals: readonly Referral[]): boolean {
  return pointedAtWard(unitId, movements, referrals).some(
    (entry) => entry.kind === "referral" || entry.status === "asked",
  );
}

export function applyLoopChecksDemoOverlay<
  T extends {
    movements: Movement[];
    units: Unit[];
    admissions?: readonly Admission[];
    referrals?: readonly Referral[];
    plannedAdmissions?: readonly PlannedAdmission[];
  },
>(state: T, now: Instant): T {
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

  const referrals = state.referrals ?? [];
  const closable = (unit: Unit) => !unit.isClosed && !asksWaitingOn(unit.id, state.movements, referrals);
  const otherAdverse = otherAdverseExampleWardIds(state.units);
  const single = (unit: Unit) => !otherAdverse.has(unit.id);
  const pointedAt = (unit: Unit) =>
    closureTransitionItems(unit, state.movements, referrals, state.plannedAdmissions ?? []).length > 0;
  // A16-17 first (never a ward still asked), then no second adverse example on the ward, then a ward
  // something accepted still points at.
  const closedUnit =
    adverseExampleWard(state.units, CLOSED_UNIT_ID, (unit) => closable(unit) && single(unit) && pointedAt(unit)) ??
    adverseExampleWard(state.units, CLOSED_UNIT_ID, (unit) => closable(unit) && single(unit)) ??
    adverseExampleWard(state.units, CLOSED_UNIT_ID, (unit) => closable(unit) && pointedAt(unit)) ??
    adverseExampleWard(state.units, CLOSED_UNIT_ID, closable);
  const limitedUnit = adverseExampleWard(
    state.units,
    LIMITED_UNIT_ID,
    (unit) => unit.id !== closedUnit?.id && (unit.intakeConstraints ?? []).length === 0,
  );
  const closedBedUnit = adverseExampleWard(
    state.units,
    CLOSED_BED_UNIT_ID,
    (unit) =>
      unit.id !== closedUnit?.id &&
      unit.id !== limitedUnit?.id &&
      demoClosedBed(unit, state.movements, state.admissions ?? []) !== undefined,
  );
  const units = state.units.map((unit): Unit => {
    if (unit.id === limitedUnit?.id && (unit.intakeConstraints ?? []).length === 0) {
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
    if (unit.id === closedUnit?.id && !unit.isClosed) {
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
    if (unit.id === closedBedUnit?.id) {
      const bedNumber = demoClosedBed(unit, state.movements, state.admissions ?? []);
      if (bedNumber === undefined) return unit;
      return {
        ...unit,
        closedBeds: [{ bedNumber, at: now - 240, by: WARD, reason: "staffing", reviewAt: now - 60 }],
      };
    }
    return unit;
  });

  return { ...state, movements, units };
}
