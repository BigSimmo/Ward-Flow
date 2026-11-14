"use client";

import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
  useWardNetwork,
} from "@/components/ward-management/ward-flow-provider";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { wardNavCounts, type WardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { useMidlandDecisions } from "@/components/ward-management/community/team-2026/midland-decisions";
import { teamReferralsToAnswer } from "@/components/ward-management/community/team-2026/team-referral-count";

/**
 * The rail's counts for the signed-in desk: `wardNavCounts` over the board, the chosen service and
 * the desk's access scope. A community team desk passes the team page's own referral figure
 * (`teamReferralsToAnswer`), so its Referrals badge reads what the page reads.
 */
export function useDeskNavCounts(): WardNavCounts {
  const { movements, units, referrals, bedReleases, leaveBeds, admissions } = useWardFlowSelect(
    "movements",
    "units",
    "referrals",
    "bedReleases",
    "leaveBeds",
    "admissions",
  );
  const now = useWardFlowClock();
  const thresholds = useDueSoonThresholds();
  const network = useWardNetwork();
  const service = useServiceScope();
  const { scope } = useEffectiveWardAccess();
  const decided = useMidlandDecisions();
  return wardNavCounts({
    movements,
    units,
    sites: network.sites,
    referrals,
    bedReleases,
    leaveBeds,
    admissions,
    now,
    thresholds,
    service,
    scope,
    teamReferrals: scope.kind === "team" ? teamReferralsToAnswer(decided) : undefined,
  });
}
