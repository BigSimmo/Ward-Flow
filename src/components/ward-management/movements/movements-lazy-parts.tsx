"use client";

import dynamic from "next/dynamic";

/**
 * Movements parts a phone's first load never draws, code split (Movements redesign, 31 Oct 2026:
 * the phone page was at its script budget): the stage pipeline (tablet and laptop only) and the
 * community desk's no-journeys panel. Both still draw on the server where they show.
 */
export const StagePipeline = dynamic(() => import("./stage-pipeline").then((m) => m.StagePipeline), {
  loading: () => null,
});

export const CommunityNoJourneys = dynamic(() => import("./community-no-journeys").then((m) => m.CommunityNoJourneys), {
  loading: () => null,
});
