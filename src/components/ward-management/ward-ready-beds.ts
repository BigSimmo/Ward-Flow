import type { Unit } from "@/components/ward-management/ward-model";

/*
 * Ready (ruling R-B-09, unified by owner ruling 13 Oct 2026). Its own module, importing nothing but
 * the Unit type, so referral matching (`ward-eligibility.ts`) can share it with the PULL_PATIENT
 * gate without reaching the bed-release model (D15, `tests/ward-referral-matching.test.ts`).
 */
/** Ready = min(allocatable, empty): main's R-B-09 rule, not clamped to the nominal bed count
 *  (clinical owner ruling, 14 Oct 2026). A closed unit counts as zero capacity; its empty beds
 *  are reported as held, never offered.
 *
 *  H-0978 / WS-15 (Josh 26 Oct 2026, "close the exact bed"): each bed the ward closed one by one
 *  (`Unit.closedBeds`, `SET_BED_CLOSED`) is never offered, so Ready drops by one for each while it
 *  is closed and rises by one when it reopens. The ward's confirmed figure (`allocatable`) is left
 *  as the ward stated it and is never rewritten, so reopening restores exactly what was there. The
 *  closed bed stays physically empty, so it joins `held`, which `bedStates` shows as Closed. The
 *  locked and open figures take each closed bed off its own kind (`lockedBedsFree`, `openBedsFree`). */
export function boundedBedAvailability(unit: Unit): { effectiveEmpty: number; available: number; held: number } {
  const isClosed = Boolean(unit.isClosed);
  const effectiveEmpty = Math.max(0, unit.empty.value);
  const closedBeds = activeClosedBeds(unit).length;
  const available = isClosed ? 0 : Math.max(0, Math.min(unit.allocatable.value, effectiveEmpty) - closedBeds);
  const held = Math.max(effectiveEmpty - available, 0);
  return { effectiveEmpty, available, held };
}

/** The existing bed partition after runtime pulls, shared by display and new allocation.
 * A pull already removed from the raw offered count sits in held; after a ward reconfirms
 * that raw count, its reservation must still come off Ready. Seeded pulls sit in occupancy. */
export function pulledBedAvailability(unit: Unit, livePulled: number) {
  const { available, held } = boundedBedAvailability(unit);
  // An exact closed bed cannot also stand for somebody's pull. Only the raw unoffered
  // remainder can already contain that reservation; the rest comes off offered capacity.
  const heldForPulls = Math.max(0, held - activeClosedBeds(unit).length);
  const pulledFromEmpty = Math.min(livePulled, heldForPulls);
  const pulledFromAvailable = Math.min(livePulled - pulledFromEmpty, available);
  return { ready: available - pulledFromAvailable, pulledFromEmpty, pulledFromAvailable };
}
/** H-0978: the beds closed by number now. A reopened mark stays as seat history (`wardStaySeats`). */
export function activeClosedBeds(unit: Unit): NonNullable<Unit["closedBeds"]> {
  return (unit.closedBeds ?? []).filter((mark) => mark.reopenedAt === undefined);
}
