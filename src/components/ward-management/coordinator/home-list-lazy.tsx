"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";
// A1K-01 / DR-03 (26 Oct 2026): the server draws My list's rows before their code arrives, so their
// styles load with Home. Without them the rows paint as plain text, then grow into cards and push
// Home down (0.16 on a phone). My list itself now loads with the page (below).
import "@/components/ward-management/alerts/alerts.module.css";

/**
 * Phone budget (22 October 2026, Home v7): the chosen alert and Beds that fit bring the Alerts
 * rows, their styles and the capacity gap derivations with them. They stay out of the first
 * load and are fetched when the browser is idle, as the shortlist panels are (see
 * shortlist-panel-lazy.tsx).
 */
const loadChosenAlertCard = () => import("./chosen-alert-card");
const loadBedsGapCard = () => import("./beds-gap-card");

/*
 * A1K-01 (26 Oct 2026): My list is the first thing on Home, so it now loads with the page. As a lazy
 * card, the layout switch at hydration (an iPad sends a Mac user agent, so the server draws desktop)
 * re-rendered it before its code arrived, and React dropped the server's rows for a frame: Home
 * jumped 0.35 on iPad portrait. It adds about 14 KB to the phone first load (within budget).
 */
export { MyListCard } from "./my-list-card";
export const ChosenAlertCard = dynamic(() => loadChosenAlertCard().then((m) => m.ChosenAlertCard), {
  loading: () => null,
});
export const BedsGapCard = dynamic(() => loadBedsGapCard().then((m) => m.BedsGapCard), { loading: () => null });

preloadWhenIdle(loadChosenAlertCard);
preloadWhenIdle(loadBedsGapCard);
