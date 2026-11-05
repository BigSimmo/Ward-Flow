import { departmentLabel, wardLabel } from "./ward-absence-labels";
import type { Movement, Unit } from "./ward-model";
import type { Admission } from "./ward-admissions";
import { edById } from "./ward-sites";

/**
 * D-76 (21 Oct 2026): a journey from an accepted community referral starts at the referring
 * community team, named without an address. Inpatient transfers resolve their sending stay first;
 * journeys without a sending stay retain the recorded ED or community fallback.
 */
export function communityOriginLabel(origin: Movement["originCommunity"]): string {
  return origin?.teamName ? `${origin.teamName} (community)` : "A community team";
}

type OriginRecords = { admissions: readonly Admission[]; units: readonly Unit[] };
type OriginMovement = Pick<
  Movement,
  "originEdId" | "originCommunity" | "sourceAdmissionId" | "referralSourceAdmissionId"
>;

/** A pinned sending stay takes precedence over the ED metadata retained by inpatient returns. */
function sourceStay(movement: OriginMovement, records: OriginRecords | undefined): Admission | undefined {
  const id = movement.sourceAdmissionId ?? movement.referralSourceAdmissionId;
  if (id === undefined || records === undefined) return undefined;
  return records.admissions.find((stay) => stay.id === id);
}

/** Where collection starts: the linked inpatient ward, community team or recorded department. */
export function movementOriginLabel(
  movement: OriginMovement,
  edName: string | undefined,
  records?: OriginRecords,
): string {
  const stay = sourceStay(movement, records);
  if (stay) return wardLabel(stay.unitId, records?.units.find((unit) => unit.id === stay.unitId)?.name);
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
export function originSiteCode(movement: OriginMovement, records?: OriginRecords): string | undefined {
  const stay = sourceStay(movement, records);
  if (stay) return records?.units.find((unit) => unit.id === stay.unitId)?.siteCode;
  return movement.originEdId === undefined ? movement.originCommunity?.siteCode : edById(movement.originEdId)?.siteCode;
}
