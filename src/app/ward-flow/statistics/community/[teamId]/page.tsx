import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { safeDecodeURIComponent } from "@/components/ward-management/ward-safe-url";

// B2 (25 Oct 2026 design re-score): the tab names the place, so several open tabs can be told
// apart. An unknown id keeps the generic title; the typed address never reaches it (DR-20).
export async function generateMetadata({ params }: { params: Promise<{ teamId: string }> }): Promise<Metadata> {
  const id = safeDecodeURIComponent((await params).teamId);
  const name = communityTeamById(id)?.name;
  return {
    title: name ? `${name} — Statistics — Ward Flow` : "Community team statistics — Ward Flow",
    description: "Synthetic single-community-team statistics section for the Ward Flow prototype.",
  };
}

/**
 * One route serving every community team, not a page per team.
 *
 * `params` is a Promise in this version of Next and is awaited here; `decodeURIComponent` undoes
 * the encoding `communityStatisticsHref` applies on the way out, so the pair stays symmetric — the
 * same reason `statistics/ward/[unitId]/page.tsx`, `statistics/ed/[edId]/page.tsx` and
 * `statistics/service/[serviceId]/page.tsx` decode before handing the id to their screens. A slug
 * that resolves to no team gets the not-found page (DA-32) — never a redirect to a
 * different team, and never an empty page that reads as a team with nothing to show.
 */
export default async function StatisticsCommunityPage({ params }: { params: Promise<{ teamId: string }> }) {
  const teamId = safeDecodeURIComponent((await params).teamId);
  // DA-32: an address that names no community team shows "Page not found", not a page reporting success.
  if (!communityTeamById(teamId)) notFound();
  return <StatisticsCommunityScreen teamId={teamId} />;
}
