import { departmentLabel } from "./ward-absence-labels";
import type { Admission } from "./ward-admissions";
import type { Movement, Unit } from "./ward-model";
import { edById } from "./ward-sites";

/**
 * D-76 (21 Oct 2026): a journey from an accepted community referral starts at the referring
 * community team, named without an address. Every other journey starts at an emergency department.
 */
export function communityOriginLabel(origin: Movement["originCommunity"]): string {
  return origin?.teamName ? `${origin.teamName} (community)` : "A community team";
}

/** Where a journey starts, in words: the department's name as given, or the referring community team. */
export function movementOriginLabel(
  movement: Pick<Movement, "originEdId" | "originCommunity">,
  edName: string | undefined,
): string {
  return movement.originEdId === undefined
    ? communityOriginLabel(movement.originCommunity)
    : departmentLabel(movement.originEdId, edName);
}

/** The origin's name: the department's, or the referring community team's. Undefined only for an ED id that does not resolve. */
export function originName(movement: Pick<Movement, "originEdId" | "originCommunity">): string | undefined {
  return movement.originEdId === undefined
    ? communityOriginLabel(movement.originCommunity)
    : edById(movement.originEdId)?.name;
}

/** The origin's site: the department's, or the site the community referral was raised from. */
export function originSiteCode(movement: Pick<Movement, "originEdId" | "originCommunity">): string | undefined {
  return movement.originEdId === undefined ? movement.originCommunity?.siteCode : edById(movement.originEdId)?.siteCode;
}

/** Said when a ward-to-ward journey's sending stay, or its ward, cannot be found. */
export const SENDING_WARD_NOT_RECORDED = "Sending ward not recorded";

/**
 * WF-J03 (8 Nov 2026): a ward-to-ward or inpatient journey starts at the sending ward, the ward of
 * its source admission, never the ED or community team the patient first came from. Undefined for
 * a journey with no source admission, which starts at its ED or community team.
 */
export function sourceWardName(
  movement: Pick<Movement, "sourceAdmissionId">,
  admissions: readonly Pick<Admission, "id" | "unitId">[],
  units: readonly Pick<Unit, "id" | "name">[],
): string | undefined {
  if (movement.sourceAdmissionId === undefined) return undefined;
  const unitId = admissions.find((admission) => admission.id === movement.sourceAdmissionId)?.unitId;
  return units.find((unit) => unit.id === unitId)?.name ?? SENDING_WARD_NOT_RECORDED;
}
