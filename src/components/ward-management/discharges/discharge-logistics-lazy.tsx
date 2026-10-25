"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Closing-the-loop package B (24 Oct 2026): the discharge arrangements panel and the weekend and
 * holiday list stay out of the discharges board's first load, fetched when the browser is idle, as
 * the coordinator's lazy panels are (see coordinator/home-list-lazy.tsx).
 */
const loadPanel = () => import("./discharge-dependencies-panel");
const loadPrep = () => import("./discharge-weekend-prep");

export const DischargeDependenciesPanel = dynamic(() => loadPanel().then((m) => m.DischargeDependenciesPanel), {
  loading: () => null,
});
export const DischargeWeekendPrep = dynamic(() => loadPrep().then((m) => m.DischargeWeekendPrep), {
  loading: () => null,
});

preloadWhenIdle(loadPanel);
preloadWhenIdle(loadPrep);
