"use client";

import { useMemo } from "react";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import type { Unit } from "@/components/ward-management/ward-model";
import { accessIsWholeNetwork, unitInScope, type WardAccess } from "@/components/ward-management/ward-role-access";

/**
 * The wards a report may total for this desk (issue #628). A scoped desk holds only its own wards'
 * stays, so a bed figure over every ward in the network would set its own patients against beds it
 * cannot see, and a ward whose pulled stays were scoped away would read them as occupied. Its
 * reports count its own wards only; a whole-network desk keeps every ward.
 */
export function ownUnits(access: WardAccess, units: readonly Unit[]): readonly Unit[] {
  if (accessIsWholeNetwork(access)) return units;
  const places = wardPlaceLookup(units);
  return units.filter((unit) => unitInScope(access.scope, unit.id, places));
}

export function useOwnUnits(units: readonly Unit[]): readonly Unit[] {
  const access = useEffectiveWardAccess();
  return useMemo(() => ownUnits(access, units), [access, units]);
}
