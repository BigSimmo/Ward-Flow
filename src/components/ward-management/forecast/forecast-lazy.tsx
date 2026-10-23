"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Phone budget (forecasting build, 23 Oct 2026): Home and ED load the forecast engine only when
 * the browser is idle, so their first-load scripts stay inside the budgets in script-budget.json.
 * `loading: () => null` keeps a Suspense boundary under a paused test clock (see home-list-lazy.tsx).
 */
const loadEdAccessRisk = () => import("./ed-access-risk-card");

export const EdAccessRiskCard = dynamic(() => loadEdAccessRisk().then((m) => m.EdAccessRiskCard), {
  loading: () => null,
});
export const HomeEdAccessLine = dynamic(() => loadEdAccessRisk().then((m) => m.HomeEdAccessLine), {
  loading: () => null,
});

preloadWhenIdle(loadEdAccessRisk);
