import type { Movement } from "@/components/ward-management/ward-model";

/** Inbound to this ward: accepted here, or referred here and still waiting. */
function isInbound(movement: Movement, unitId: string): boolean {
  return movement.acceptedUnitId === unitId || (movement.referredUnitIds?.includes(unitId) ?? false);
}

/**
 * The clearance cards in the ward's Notices panel: one per transfer recorded as not cleared, and one
 * card listing every open transfer with no clearance recorded. The panel and the Notices badge both
 * count from here, so the badge never leaves out a card the panel shows.
 */
export function wardClearanceAlerts(movements: readonly Movement[], unitId: string) {
  const missing = movements.filter((m) => isInbound(m, unitId) && m.medicalClearance?.cleared === false);
  const unrecorded = movements.filter(
    (m) => m.closure === undefined && isInbound(m, unitId) && m.medicalClearance === undefined,
  );
  return { missing, unrecorded, count: missing.length + (unrecorded.length > 0 ? 1 : 0) };
}
