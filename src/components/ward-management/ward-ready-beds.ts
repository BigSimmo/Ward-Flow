import type { Unit } from "@/components/ward-management/ward-model";

/*
 * Ready (ruling R-B-09, unified by owner ruling 13 Oct 2026). Its own module, importing nothing but
 * the Unit type, so referral matching (`ward-eligibility.ts`) can share it with the PULL_PATIENT
 * gate without reaching the bed-release model (D15, `tests/ward-referral-matching.test.ts`).
 */
/** Reconcile reported empty/allocatable counts with the unit's physical bed count. */
export function boundedBedAvailability(unit: Unit): { effectiveEmpty: number; available: number; held: number } {
  const isClosed = Boolean(unit.isClosed) || unit.beds === 0;
  const effectiveEmpty = Math.min(Math.max(0, unit.empty.value), unit.beds);
  // Ruling R-B-09 (owner ruling 13 Oct 2026): the ONE home of Ready. Closed beds remain physically
  // empty and are counted as held; they are simply not offered.
  const available = isClosed ? 0 : Math.max(0, Math.min(unit.allocatable.value, effectiveEmpty));
  const held = Math.max(effectiveEmpty - available, 0);
  return { effectiveEmpty, available, held };
}
