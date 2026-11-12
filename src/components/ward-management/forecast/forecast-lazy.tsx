"use client";

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

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

/*
 * Phone load audit (10 Nov 2026): no `loading` here, so no Suspense boundary of its own. With an
 * empty fallback, arriving on an ED page by a tap drew the board first and the card popped in above
 * it about 2 s later on slow signal, pushing the list down (layout shift 0.29). Now the page waits
 * on the card under the route's loading placeholder and lands whole. A first load is unchanged: the
 * server draws the card and preloads its code.
 */
export const EdAccessRiskCard = dynamic(withLoadRetry(() => loadEdAccessRisk().then((m) => m.EdAccessRiskCard)));

preloadWhenIdle(loadEdAccessRisk);
