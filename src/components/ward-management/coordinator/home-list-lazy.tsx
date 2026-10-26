"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";
// A1K-01 / DR-03 (26 Oct 2026): the server draws My list's rows before their code arrives, so their
// styles load with Home. Without them the rows paint as plain text, then grow into cards and push
// Home down (0.16 on a phone). Only the styles load early; the scripts still wait for idle.
import "@/components/ward-management/alerts/alerts.module.css";

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
