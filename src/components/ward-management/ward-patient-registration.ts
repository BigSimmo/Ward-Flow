import { communityTeamOptions } from "./referrals/referral-destination-options";
import { HEALTH_SERVICES, type Unit } from "./ward-model";
import type { WardAccess, WardAccessScope, PlaceLookup } from "./ward-role-access";
import { unitInScope, edInScope } from "./ward-role-access";
import { edById, siteByCode } from "./ward-sites";

/** A bounded source desk, not a clinical encounter or a general access grant. */
export type PatientRegistrationScope = { kind: "ed" | "ward" | "team" | "site" | "service"; placeId: string };

export function patientRegistrationScope(
  scope: WardAccessScope,
  wardUnitId?: string,
): PatientRegistrationScope | undefined {
  switch (scope.kind) {
    case "ed":
      return { kind: "ed", placeId: scope.edId };
    case "team":
      return { kind: "team", placeId: scope.teamName };
    case "site":
      return { kind: "site", placeId: scope.siteCode };
    case "service":
      return { kind: "service", placeId: scope.service };
    case "ward": {
      const unitId =
        wardUnitId && scope.unitIds.includes(wardUnitId)
          ? wardUnitId
          : scope.unitIds.length === 1
            ? scope.unitIds[0]
            : undefined;
      return unitId ? { kind: "ward", placeId: unitId } : undefined;
    }
    default:
      return undefined;
  }
}

export function isPatientRegistrationScope(
  value: unknown,
  units: readonly Pick<Unit, "id">[],
): value is PatientRegistrationScope {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== "kind,placeId"
  )
    return false;
  const scope = value as PatientRegistrationScope;
  if (typeof scope.placeId !== "string") return false;
  switch (scope.kind) {
    case "ed":
      return !!edById(scope.placeId);
    case "ward":
      return units.some((unit) => unit.id === scope.placeId);
    case "team":
      return communityTeamOptions().includes(scope.placeId);
    case "site":
      return !!siteByCode(scope.placeId);
    case "service":
      return (HEALTH_SERVICES as readonly string[]).includes(scope.placeId);
    default:
      return false;
  }
}

/** Access follows the same source place; count-only and administrative desks never gain identity. */
export function registrationIsInScope(
  registration: PatientRegistrationScope | undefined,
  access: WardAccess,
  places: PlaceLookup,
): boolean {
  if (!registration || ["executive", "admin", "officer"].includes(access.role)) return false;
  const { scope } = access;
  switch (registration.kind) {
    case "ward":
      return unitInScope(scope, registration.placeId, places);
    case "ed":
      return edInScope(scope, registration.placeId, places);
    case "team":
      return scope.kind === "team" && scope.teamName === registration.placeId;
    case "site":
      return scope.kind === "site"
        ? scope.siteCode === registration.placeId
        : scope.kind === "service" && places.siteService?.(registration.placeId) === scope.service;
    case "service":
      return scope.kind === "service" && scope.service === registration.placeId;
  }
}
