import { departmentLabel } from "./ward-absence-labels";
import type { Movement } from "./ward-model";
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
