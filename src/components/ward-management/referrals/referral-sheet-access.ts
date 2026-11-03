// RQ9 (Josh, 3 Nov 2026): who sees where a referral was sent. The clinical facts are for everyone
// who can open the referral; the "Sent to" tab is for the coordinator and the desk that sent it.
// Everyone else gets no tab at all, so the sheet never hints at other wards' answers.
import type { Referral, Unit } from "@/components/ward-management/ward-model";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { referralSentByDesk } from "@/components/ward-management/ward-referral-sender";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

/**
 * True for a coordinator (any scope), and for the desk that raised this referral, judged by the
 * app's one sender rule (`referralSentByDesk`): the ED at the sending site, the ward it came from,
 * or the community team named as its sender under any recognised spelling. Never the site bed
 * manager (Josh, 3 Nov 2026).
 */
export function referralSentToVisible(
  access: WardAccess,
  referral: Pick<Referral, "source" | "originSiteCode" | "originUnitId" | "sendingTeamName">,
  units: readonly Unit[] = [],
): boolean {
  if (access.role === "coordinator") return true;
  if (access.role !== "ed" && access.role !== "ward" && access.role !== "community") return false;
  return referralSentByDesk(referral, access, wardPlaceLookup(units));
}
