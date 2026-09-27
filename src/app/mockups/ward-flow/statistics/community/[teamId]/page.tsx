import type { Metadata } from "next";

import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";

export const metadata: Metadata = {
  title: "Community team statistics — Ward Flow",
  description: "Synthetic single-community-team statistics section for the Ward Flow prototype.",
};

/**
 * One route serving every community team, not a page per team.
 *
 * `params` is a Promise in this version of Next and is awaited here; `decodeURIComponent` undoes
 * the encoding `communityStatisticsHref` applies on the way out, so the pair stays symmetric — the
 * same reason `statistics/ward/[unitId]/page.tsx`, `statistics/ed/[edId]/page.tsx` and
 * `statistics/service/[serviceId]/page.tsx` decode before handing the id to their screens. A slug
 * that resolves to no team is the screen's own honest not-found state — never a redirect to a
 * different team, and never an empty page that reads as a team with nothing to show.
 */
export default async function StatisticsCommunityPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <StatisticsCommunityScreen teamId={decodeURIComponent(teamId)} />;
}
