"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Phone budget (31 Oct 2026, Home and Activity build): the Activity panel and the Planned list
 * bring the activity feed and the forecast model with them. Neither shows at first paint (the
 * panel opens on a press, Planned is the third view), so both stay out of the first load and are
 * fetched when the browser is idle, as the Beds that fit card is (see home-list-lazy.tsx).
 */
const loadActivityPanel = () => import("./activity-panel");
const loadPlannedList = () => import("./planned-list");

export const ActivityPanel = dynamic(() => loadActivityPanel().then((m) => m.ActivityPanel), { loading: () => null });
export const PlannedList = dynamic(() => loadPlannedList().then((m) => m.PlannedList), { loading: () => null });

preloadWhenIdle(loadActivityPanel);
preloadWhenIdle(loadPlannedList);
