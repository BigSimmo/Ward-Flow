"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Phone budget (22 October 2026, Home v7): My list, the chosen alert and Beds that fit bring the
 * Alerts rows, their styles and the capacity gap derivations with them. They stay out of the first
 * load and are fetched when the browser is idle, as the shortlist panels are (see
 * shortlist-panel-lazy.tsx).
 */
const loadMyListCard = () => import("./my-list-card");
const loadChosenAlertCard = () => import("./chosen-alert-card");
const loadBedsGapCard = () => import("./beds-gap-card");

export const MyListCard = dynamic(() => loadMyListCard().then((m) => m.MyListCard), { loading: () => null });
export const ChosenAlertCard = dynamic(() => loadChosenAlertCard().then((m) => m.ChosenAlertCard), {
  loading: () => null,
});
export const BedsGapCard = dynamic(() => loadBedsGapCard().then((m) => m.BedsGapCard), { loading: () => null });

preloadWhenIdle(loadMyListCard);
preloadWhenIdle(loadChosenAlertCard);
preloadWhenIdle(loadBedsGapCard);
