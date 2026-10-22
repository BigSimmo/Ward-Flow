import type { Movement } from "@/components/ward-management/ward-model";

/** Open and inbound to this ward: accepted here, or referred here and still waiting. A closed transfer
 * has nothing left to clear, so it never holds the badge above zero. */
function isOpenInbound(movement: Movement, unitId: string): boolean {
  if (movement.closure !== undefined) return false;
  return movement.acceptedUnitId === unitId || (movement.referredUnitIds?.includes(unitId) ?? false);
}

/**
 * The clearance rows in the ward's Notices panel: one per transfer recorded as not cleared, and one per
 * open transfer with no clearance recorded (Notices option A, 22 Oct 2026: each row has its own action).
 * The panel and the Notices badge both count from here, so the badge never leaves out a row the panel shows.
 */
export function wardClearanceAlerts(movements: readonly Movement[], unitId: string) {
  const missing = movements.filter((m) => isOpenInbound(m, unitId) && m.medicalClearance?.cleared === false);
  const unrecorded = movements.filter((m) => isOpenInbound(m, unitId) && m.medicalClearance === undefined);
  return { missing, unrecorded, count: missing.length + unrecorded.length };
}
