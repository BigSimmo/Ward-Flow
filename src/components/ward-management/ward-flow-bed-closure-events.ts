import type { AuditDecision } from "./ward-audit";
import { bedIsOccupied } from "./ward-admissions";
import { WARD_CLOSURE_REASON_IDS } from "./capacity/ward-closure";
import type { WardFlowEvent } from "./ward-flow-events";
import type { findUnit, heldBedRefusal, reject, replaceUnit, WardFlowState } from "./ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import type { Unit } from "./ward-model";
import { activeClosedBeds, boundedBedAvailability } from "./ward-ready-beds";
import { wardStaySeats } from "./ward/ward-bed-layout";

/**
 * H-0978 / WS-15 (Josh 26 Oct 2026, "Close the exact bed"): the ward closes and reopens one exact
 * empty bed from the bed drawer, recorded as a closed mark on that bed (`Unit.closedBeds`). Closing
 * bed 3 shows bed 3 as Closed, never another tile.
 *
 * The ward's confirmed figure (`allocatable`) is never rewritten here. A closed mark is simply never
 * offered: `boundedBedAvailability` takes one off Ready for each mark, so the bed joins Closed while
 * it is closed and reopening restores exactly the figure that was there.
 *
 * Only an empty bed that is free to offer can be closed: never one a current stay sits in (occupied,
 * on leave or pulled), never one held for somebody on their way, and only while the ward has a Ready
 * bed to take away. The reducer passes its helpers in, since this file may not import it at run time.
 */
export type BedClosureEvent = Extract<WardFlowEvent, { type: "SET_BED_CLOSED" }>;

export type BedClosureHelpers = {
  findUnit: typeof findUnit;
  heldBedRefusal: typeof heldBedRefusal;
  reject: typeof reject;
  replaceUnit: typeof replaceUnit;
};

/**
 * The bed numbers a current stay on this ward sits in: its recorded bed, else its replayed seat, from
 * the same inputs the Bed board uses (`wardStaySeats`), so a tile shown Ready is never refused here.
 */
function bedsWithAStay(state: WardFlowState, unit: Unit): Set<number> {
  const seats = wardStaySeats(unit, state.admissions);
  const taken = new Set<number>();
  for (const stay of state.admissions) {
    if (stay.unitId !== unit.id) continue;
    if (!bedIsOccupied(stay)) continue;
    const bed = stay.bedNumber ?? seats.get(stay.id);
    if (bed !== undefined) taken.add(bed);
  }
  return taken;
}

export function reduceBedClosureEvent(
  state: WardFlowState,
  event: BedClosureEvent,
  decision: AuditDecision,
  { findUnit, heldBedRefusal, reject, replaceUnit }: BedClosureHelpers,
): WardFlowState {
  switch (event.type) {
    case "SET_BED_CLOSED": {
      // Claim, not proof, as CONFIRM_CAPACITY: the caller's stated unit against the unit written to.
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `SET_BED_CLOSED was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      if (!Number.isInteger(event.bedNumber) || event.bedNumber < 1 || event.bedNumber > unit.beds) {
        return reject(state, event, `Bed ${String(event.bedNumber)} is not one of ${unit.name}'s ${unit.beds} beds`);
      }
      if (typeof event.closed !== "boolean") return reject(state, event, "SET_BED_CLOSED must say closed or reopened");
      const marks = unit.closedBeds ?? [];
      const isMarked = activeClosedBeds(unit).some((mark) => mark.bedNumber === event.bedNumber);

      if (!event.closed) {
        if (event.reason !== undefined) return reject(state, event, "Reopening a bed takes no reason");
        if (!isMarked) return reject(state, event, `Bed ${event.bedNumber} on ${unit.name} is not closed`);
        decision.outcome = "accepted";
        decision.reasonCode = "none";
        // The mark stays as seat history with `reopenedAt`: a stay seated while the bed was closed
        // keeps its bed when it reopens, never moving into the reopened bed (`wardStaySeats`).
        const reopened: Unit = {
          ...unit,
          closedBeds: marks.map((mark) =>
            mark.bedNumber === event.bedNumber && mark.reopenedAt === undefined
              ? { ...mark, reopenedAt: event.now }
              : mark,
          ),
        };
        return replaceUnit(state, unit.id, reopened);
      }

      if (isMarked) return reject(state, event, `Bed ${event.bedNumber} on ${unit.name} is already closed`);
      // Chosen, never typed: the runtime half of the union-type check, for an untyped caller.
      if (event.reason !== undefined && !WARD_CLOSURE_REASON_IDS.includes(event.reason)) {
        return reject(state, event, "SET_BED_CLOSED reason must be chosen from WARD_CLOSURE_REASONS");
      }
      if (bedsWithAStay(state, unit).has(event.bedNumber)) {
        return reject(state, event, `Bed ${event.bedNumber} on ${unit.name} has someone in it, so it cannot be closed`);
      }
      const held = heldBedRefusal(state, unit, event.bedNumber);
      if (held) return reject(state, event, `${held}, so it cannot be closed`);
      if (boundedBedAvailability(unit).available < 1) {
        return reject(state, event, `${unit.name} has no Ready bed to close`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const closed: Unit = {
        ...unit,
        closedBeds: [
          ...marks,
          {
            bedNumber: event.bedNumber,
            at: event.now,
            by: WARD_FLOW_ROLE_LABELS[event.role],
            ...(event.reason !== undefined ? { reason: event.reason } : {}),
          },
        ],
      };
      return replaceUnit(state, unit.id, closed);
    }
  }
}
