import { communityTeamKey } from "@/components/ward-management/ward-access-scope";
import type { Referral } from "@/components/ward-management/ward-model";
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

/**
 * A route desk sends only its own kind of referral, so a ward never acts as sender on one it is
 * answering. The screens ask this with `referralSentByDesk`, since a demo desk may have no scope.
 */
export function routeSentKind(routeRole: string, source: Referral["source"]): boolean {
  if (routeRole === "ward") return source === "psychiatric_ward";
  if (routeRole === "ed") return source === "ed_medical";
  if (routeRole === "community") return source !== "psychiatric_ward" && source !== "ed_medical";
  return true;
}
