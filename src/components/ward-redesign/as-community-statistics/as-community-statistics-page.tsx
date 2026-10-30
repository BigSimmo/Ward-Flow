"use client";

import polish from "@/components/ward-management/statistics/statistics-polish.module.css";
import { CommunityStatisticsScreen } from "./community-statistics-screen";

/**
 * As community clinician: the Statistics mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 *
 * Role view (community clinician, D-80): a team desk's Statistics opens its own team's page as
 * counts only (`ownStatisticsHrefFor` sends the rail's Statistics to `/statistics/community/midland`),
 * never the network page the coordinator's mock-up draws. Wrapped as the route's layout wraps it.
 */
export function AsCommunityStatisticsPage() {
  return (
    <div className={polish.root}>
      <CommunityStatisticsScreen teamId="midland" />
    </div>
  );
}
