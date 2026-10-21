"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Phone budget (21 October 2026): the phone ward sheet only draws once someone taps a ward on Home,
 * so its code stays out of the first load and is fetched when the browser is idle, as the shortlist
 * panels are (see shortlist-panel-lazy.tsx). `loading` keeps the wait inside the sheet's own
 * Suspense boundary rather than blanking the whole route.
 */
const loadHomeWardSheet = () => import("./home-phone-sheets");

export const HomeWardSheet = dynamic(() => loadHomeWardSheet().then((m) => m.HomeWardSheet), {
  loading: () => null,
});

preloadWhenIdle(loadHomeWardSheet);
