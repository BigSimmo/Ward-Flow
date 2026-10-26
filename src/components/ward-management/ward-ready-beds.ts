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
 *  closed bed stays physically empty, so it joins `held`, which `bedStates` shows as Closed. */
export function boundedBedAvailability(unit: Unit): { effectiveEmpty: number; available: number; held: number } {
  const isClosed = Boolean(unit.isClosed);
  const effectiveEmpty = Math.max(0, unit.empty.value);
  const closedBeds = unit.closedBeds?.length ?? 0;
  const available = isClosed ? 0 : Math.max(0, Math.min(unit.allocatable.value, effectiveEmpty) - closedBeds);
  const held = Math.max(effectiveEmpty - available, 0);
  return { effectiveEmpty, available, held };
}
