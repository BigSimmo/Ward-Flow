"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Phone budget (21 October 2026): the desktop "Since you last looked" band only draws once its hero
 * count is opened, so its code stays out of the first load and is fetched when the browser is idle,
 * as the shortlist panels are (see shortlist-panel-lazy.tsx).
 */
const loadSinceLastLookBand = () => import("./since-last-look-band");

export const SinceLastLookPanel = dynamic(() => loadSinceLastLookBand().then((m) => m.SinceLastLookPanel), {
  loading: () => null,
});

preloadWhenIdle(loadSinceLastLookBand);
