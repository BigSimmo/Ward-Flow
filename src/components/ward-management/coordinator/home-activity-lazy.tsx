"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Phone budget (31 Oct 2026, Home and Activity build): the Planned list brings the forecast model
 * with it. It does not show at first paint (Planned is the third view), so it stays out of the
 * first load and is fetched when the browser is idle, as the Beds that fit card is (see
 * home-list-lazy.tsx). The Activity panel is the app bar's now (Q99, 1 Nov 2026), loaded from
 * `shell/ward-bar-lazy-panels.tsx`.
 */
const loadPlannedList = () => import("./planned-list");

export const PlannedList = dynamic(() => loadPlannedList().then((m) => m.PlannedList), { loading: () => null });

preloadWhenIdle(loadPlannedList);
