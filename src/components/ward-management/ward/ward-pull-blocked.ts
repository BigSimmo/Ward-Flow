import type { Movement, Unit } from "@/components/ward-management/ward-model";

/**
 * Why the ward cannot pull a bed for this person yet, or `undefined` when it can. Kept apart from
 * `ward-arrivals-corridor.tsx` so the Home tab can ask without loading the arrivals corridor
 * (phone script budget, 19 October 2026).
 */
export function pullBlockedReason(movement: Movement, unit: Unit, who?: string): string | undefined {
  if (movement.acceptedUnitId !== unit.id) {
    return `${who ?? "This patient"} was accepted at a different unit, not ${unit.name}.`;
  }
  if (unit.allocatable.value <= 0) {
    return `No allocatable bed remains at ${unit.name}.`;
  }
  return undefined;
}
