"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";
// A1K-01 / DR-03 (26 Oct 2026): the server draws these cards before their code arrives, so their
// styles load with the page. Without them the cards paint as plain text, then grow and push the
// page down. Only the styles load early; the scripts still wait for idle.
import "./forecast.module.css";

/**
 * Phone budget (forecasting build, 23 Oct 2026): Home and ED load the forecast engine only when
 * the browser is idle, so their first-load scripts stay inside the budgets in script-budget.json.
 * `loading: () => null` keeps a Suspense boundary under a paused test clock (see home-list-lazy.tsx).
 */
const loadEdAccessRisk = () => import("./ed-access-risk-card");

export const EdAccessRiskCard = dynamic(() => loadEdAccessRisk().then((m) => m.EdAccessRiskCard), {
  loading: () => null,
});

preloadWhenIdle(loadEdAccessRisk);
