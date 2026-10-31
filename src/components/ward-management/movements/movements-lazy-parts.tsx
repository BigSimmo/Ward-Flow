"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Movements parts a phone's first load never draws, code split (Movements redesign, 31 Oct 2026:
 * the phone page was at its script budget): the stage pipeline (tablet and laptop only) and the
 * community desk's no-journeys panel. Both still draw on the server where they show.
 *
 * The stage pipeline has no `loading` option, so no Suspense boundary of its own: it arrives with
 * the page instead of a moment after it, which made the worklist under it jump (see the timeline's
 * note in movement-horizon-gantt-lazy.tsx). Its code is fetched when the browser is idle, so a
 * phone turned to landscape normally finds it there.
 */
// The import sits inside `dynamic()` so the build links it to the pipeline's stylesheet (see the timeline).
export const StagePipeline = dynamic(() => import("./stage-pipeline").then((m) => m.StagePipeline));

preloadWhenIdle(() => import("./stage-pipeline"));

export const CommunityNoJourneys = dynamic(() => import("./community-no-journeys").then((m) => m.CommunityNoJourneys), {
  loading: () => null,
});
