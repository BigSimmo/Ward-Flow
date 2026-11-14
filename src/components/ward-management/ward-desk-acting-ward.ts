import { useEffectiveWardAccess } from "./shell/ward-access-store";
import type { WardAccess } from "./ward-role-access";

/**
 * M9 (mechanics and clock audit, 14 Nov 2026): the ward a ward desk acts as for a bed at `unitId`.
 * It is that ward only when the ward is one of the desk's own; otherwise `null`, and the screen does
 * not offer the step. Screens used to copy the acting ward from the record, so a ward desk looking at
 * a journey it sent, now accepted elsewhere, was offered steps on the other ward's bed: the local
 * demo recorded them against the wrong ward and the signed-in server refused them after the press.
 * Pull the bed answers the same way (`acceptedPullDesk`); a demonstration ward desk with no ward
 * scope acts as the ward that holds the bed.
 */
export function deskActingWard(access: WardAccess, unitId: string | null | undefined): string | null {
  if (!unitId) return null;
  if (access.scope.kind === "ward" && !access.scope.unitIds.includes(unitId)) return null;
  return unitId;
}

/**
 * For a screen raising as `role`: the `actingUnitId` a ward desk sends for a bed at `unitId`, and
 * whether the step is off because the bed is at another ward. Other roles name no acting ward.
 */
export function useDeskActingWard(
  role: string,
  unitId: string | null | undefined,
): { acting: { actingUnitId?: string }; bedElsewhere: boolean } {
  const access = useEffectiveWardAccess();
  if (role !== "ward") return { acting: {}, bedElsewhere: false };
  const actingUnitId = deskActingWard(access, unitId);
  return actingUnitId ? { acting: { actingUnitId }, bedElsewhere: false } : { acting: {}, bedElsewhere: true };
}
