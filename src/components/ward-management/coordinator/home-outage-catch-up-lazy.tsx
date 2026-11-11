"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";
import { loadBeforeHeldReveal } from "../shell/held-reveal-loaders";

/**
 * Phone budget: Catch-up after the outage (Batch 4 item 25, D-142) renders nothing until an outage
 * is recorded, so it stays off Home's first load and is fetched when the browser is idle, as the
 * since banner is (home-since-banner-lazy.tsx).
 */
const loadCatchUp = () => import("./home-outage-catch-up");

export const HomeOutageCatchUp = dynamic(() => loadCatchUp().then((m) => m.HomeOutageCatchUp), {
  loading: () => null,
});

preloadWhenIdle(loadCatchUp);
// A held first load draws this card with the page (D-137 follow-up, held-reveal-loaders.ts).
loadBeforeHeldReveal(loadCatchUp);
