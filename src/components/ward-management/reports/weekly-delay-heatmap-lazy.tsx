"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Feature 42 (9 Nov 2026): the delayed discharge grid stays out of the Weekly page's first load,
 * fetched when the browser is idle. It sits under the week's pressure figures.
 */
const loadHeatmap = () => import("./weekly-delay-heatmap");

export const WeeklyDelayHeatmap = dynamic(() => loadHeatmap().then((m) => m.WeeklyDelayHeatmap), {
  loading: () => null,
});

preloadWhenIdle(loadHeatmap);
