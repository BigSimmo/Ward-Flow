"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Phone budget: the "since you were last here" line brings the last-look comparison and its sheet
 * with it. It renders nothing until something is new, so it stays off Home's first load and is
 * fetched when the browser is idle, as Later today is (see home-activity-lazy.tsx).
 */
const loadSinceBanner = () => import("./home-since-banner");

export const HomeSinceBanner = dynamic(() => loadSinceBanner().then((m) => m.HomeSinceBanner), {
  loading: () => null,
});

preloadWhenIdle(loadSinceBanner);
