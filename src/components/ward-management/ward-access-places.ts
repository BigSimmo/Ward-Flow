/**
 * The place answers the access table needs (`PlaceLookup` in `ward-role-access.ts`), read from the
 * synthetic site registry. Kept apart so `ward-role-access.ts` and `ward-access-scope.ts` stay free
 * of the registry and run unchanged on the server.
 */
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import type { Unit } from "@/components/ward-management/ward-model";
import type { PlaceLookup } from "@/components/ward-management/ward-role-access";
import { edHealthService, unitHealthService } from "@/components/ward-management/ward-service-scope";
import { edById } from "@/components/ward-management/ward-sites";

export function wardPlaceLookup(units: readonly Unit[]): PlaceLookup {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  return {
    unitSiteCode: (unitId) => byId.get(unitId)?.siteCode,
    unitService: (unitId) => {
      const unit = byId.get(unitId);
      return unit ? unitHealthService(unit) : undefined;
    },
    edSiteCode: (edId) => edById(edId)?.siteCode,
    edService: (edId) => edHealthService(edId),
    teamSlug: (teamName) => communityTeamSlug(teamName),
  };
}
