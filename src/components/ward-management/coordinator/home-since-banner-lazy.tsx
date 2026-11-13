"use client";

import { loadEarly } from "../load-early";

/**
 * Phone budget: the "since you were last here" line brings the last-look comparison and its sheet
 * with it, so it stays off Home's first load. It is on screen at rest (before any review it counts
 * from the start of the shift), so it is fetched as soon as Home's code runs and Home holds its
 * columns until it arrives (`useHomeCardsSettled`): arriving late, it pushed My list down (layout
 * shift on Home, 11 Nov 2026).
 */
export const sinceBanner = loadEarly(() => import("./home-since-banner").then((m) => m.HomeSinceBanner));
export const HomeSinceBanner = sinceBanner.Card;

sinceBanner.start();
