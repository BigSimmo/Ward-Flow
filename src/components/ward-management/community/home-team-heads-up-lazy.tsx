"use client";

import dynamic from "next/dynamic";

/**
 * Home team heads-up (item 46), loaded after the page so the community screen keeps its phone
 * script budget. Renders nothing while loading, as the card does when no patient is in ED.
 */
export const HomeTeamHeadsUp = dynamic(
  () => import("@/components/ward-management/home-team-heads-up-card").then((m) => m.HomeTeamHeadsUpCard),
  {
    loading: () => null,
  },
);
