"use client";

import { earlyHomeCard } from "./home-early-card";

/**
 * Phone budget: the "since you were last here" line brings the last-look comparison and its sheet
 * with it. It renders nothing until something is new, so it stays off Home's first load and is
 * fetched as soon as Home's code runs, so it draws in Home's first frame and never pushes My list
 * down as it arrives (home-early-card.tsx).
 */
const loadSinceBanner = () => import("./home-since-banner");

export const HomeSinceBanner = earlyHomeCard(() => loadSinceBanner().then((m) => m.HomeSinceBanner));
