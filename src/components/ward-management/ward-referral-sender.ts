import { communityTeamKey } from "@/components/ward-management/ward-access-scope";
import { routeSentKind } from "@/components/ward-management/ward-journey-sender";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import {
  accessIsWholeNetwork,
  unitInScope,
  type PlaceLookup,
  type WardAccess,
} from "@/components/ward-management/ward-role-access";

/**
 * Did this desk send this referral (role access plan v2, D-80). A ward's or team's scope also takes
 * in referrals sent TO it, so the sender's own tools (withdraw, correct, mark requested information
 * supplied) ask this rather than scope alone. Pure and browser free: the server's write check and
 * the referral screens use the same rule. A whole-network desk acts for every sender.
 */
export function referralSentByDesk(
  referral: Pick<Referral, "source" | "originSiteCode" | "originUnitId" | "sendingTeamName">,
  access: WardAccess,
  places: PlaceLookup,
): boolean {
  if (accessIsWholeNetwork(access)) return true;
  const scope = access.scope;
  switch (access.role) {
    case "ed":
      return (
        referral.source === "ed_medical" &&
        scope.kind === "ed" &&
        places.edSiteCode(scope.edId) === referral.originSiteCode
      );
    case "community": {
      if (referral.source === "psychiatric_ward" || referral.source === "ed_medical") return false;
      if (scope.kind !== "team" || referral.sendingTeamName === undefined) return false;
      const own = communityTeamKey(scope.teamName);
      return (
        own !== "" &&
        (communityTeamKey(referral.sendingTeamName) === own ||
          referral.sendingTeamName === places.teamSlug(scope.teamName))
      );
    }
    case "ward":
      return (
        referral.source === "psychiatric_ward" &&
        referral.originUnitId !== undefined &&
        unitInScope(scope, referral.originUnitId, places)
      );
    case "coordinator":
      return true;
    default:
      return false;
  }
}

export { routeSentKind };

/**
 * Did this desk send this journey (D-80). A journey leaving a stay was sent by that stay's ward,
 * even when the stay itself began from another place's referral (a repatriation copies both
 * links). Otherwise a ward sent it when the referral's origin is one of its own, and any other
 * desk asks `referralSentByDesk` of the journey's referral. The server's write check and the legal
 * forms screen share it.
 */
export function journeySentByDesk(
  records: {
    referrals: readonly Pick<Referral, "id" | "source" | "originSiteCode" | "originUnitId" | "sendingTeamName">[];
    admissions: readonly Pick<Admission, "id" | "unitId">[];
  },
  movement: Pick<Movement, "referralId" | "sourceAdmissionId">,
  access: WardAccess,
  places: PlaceLookup,
): boolean {
  if (accessIsWholeNetwork(access)) return true;
  const referral = movement.referralId
    ? records.referrals.find((candidate) => candidate.id === movement.referralId)
    : undefined;
  const leftStay = movement.sourceAdmissionId !== undefined;
  if (access.role === "ward") {
    const stayWard = leftStay
      ? records.admissions.find((admission) => admission.id === movement.sourceAdmissionId)?.unitId
      : undefined;
    const sendingWard =
      stayWard ??
      (leftStay ? undefined : referral?.originUnitId) ??
      (movement as { originUnitId?: string }).originUnitId;
    return sendingWard !== undefined && unitInScope(access.scope, sendingWard, places);
  }
  if (leftStay && access.role === "community") return false;
  return referral !== undefined && referralSentByDesk(referral, access, places);
}
