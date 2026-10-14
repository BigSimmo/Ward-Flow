import type { Unit } from "@/components/ward-management/ward-model";

/*
 * Ready (ruling R-B-09, unified by owner ruling 13 Oct 2026). Its own module, importing nothing but
 * the Unit type, so referral matching (`ward-eligibility.ts`) can share it with the PULL_PATIENT
 * gate without reaching the bed-release model (D15, `tests/ward-referral-matching.test.ts`).
 */
/** Ready = min(allocatable, empty): main's R-B-09 rule, not clamped to the nominal bed count
 *  (clinical owner ruling, 14 Oct 2026). A closed unit counts as zero capacity; its empty beds
 *  are reported as held, never offered. */
export function boundedBedAvailability(unit: Unit): { effectiveEmpty: number; available: number; held: number } {
  const isClosed = Boolean(unit.isClosed);
  const effectiveEmpty = Math.max(0, unit.empty.value);
  const available = isClosed ? 0 : Math.max(0, Math.min(unit.allocatable.value, effectiveEmpty));
  const held = Math.max(effectiveEmpty - available, 0);
  return { effectiveEmpty, available, held };
}
