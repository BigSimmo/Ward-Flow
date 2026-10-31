"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Closing-the-loop package B (24 Oct 2026): the discharge arrangements panel stays out of the
 * discharges board's first load, fetched when the browser is idle, as the coordinator's lazy panels
 * are (see coordinator/home-list-lazy.tsx). The weekend and holiday list no longer loads here: since
 * the redesign it sits above the list, and loading it late moved the whole list on hydration.
 */
const loadPanel = () => import("./discharge-dependencies-panel");

export const DischargeDependenciesPanel = dynamic(() => loadPanel().then((m) => m.DischargeDependenciesPanel), {
  loading: () => null,
});

preloadWhenIdle(loadPanel);
