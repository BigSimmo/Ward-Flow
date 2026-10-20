import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { safeDecodeURIComponent } from "@/components/ward-management/ward-safe-url";

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
 * that resolves to no team gets the route's real 404 (DA-32) — never a redirect to a
 * different team, and never an empty page that reads as a team with nothing to show.
 */
export default async function StatisticsCommunityPage({ params }: { params: Promise<{ teamId: string }> }) {
  const teamId = safeDecodeURIComponent((await params).teamId);
  // DA-32: an address that names no community team is a real 404, not a page reporting success.
  if (!communityTeamById(teamId)) notFound();
  return <StatisticsCommunityScreen teamId={teamId} />;
}
