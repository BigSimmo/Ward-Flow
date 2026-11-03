// RQ9 (Josh, 3 Nov 2026): who sees where a referral was sent. The clinical facts are for everyone
// who can open the referral; the "Sent to" tab is for the coordinator and the desk that sent it.
// Everyone else gets no tab at all, so the sheet never hints at other wards' answers.
import type { Referral } from "@/components/ward-management/ward-model";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { edById } from "@/components/ward-management/ward-sites";

/**
 * True for a coordinator, and for the desk that raised this referral: the ED at the sending site
 * (an ED medical referral), the ward it came from, or the community team named as its sender.
 * Read only from the record; a desk the record does not name is never treated as the sender.
 */
export function referralSentToVisible(
  access: WardAccess,
  referral: Pick<Referral, "source" | "originSiteCode" | "originUnitId" | "sendingTeamName">,
): boolean {
  if (access.role === "coordinator") return true;
  const scope = access.scope;
  if (access.role === "ed" && scope.kind === "ed") {
    const ed = edById(scope.edId);
    return referral.source === "ed_medical" && ed !== undefined && ed.siteCode === referral.originSiteCode;
  }
  if (access.role === "ward" && scope.kind === "ward") {
    return referral.originUnitId !== undefined && scope.unitIds.includes(referral.originUnitId);
  }
  if (access.role === "community" && scope.kind === "team") {
    const team = referral.sendingTeamName?.trim();
    return team !== undefined && team !== "" && team === scope.teamName;
  }
  return false;
}
