"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Scorecard follow-up (16 October 2026): the desk switcher (about 9 KB gzipped) only draws once
 * someone opens it, yet the shell imported it on every page. The shell imports it from here, so a
 * first load skips that code, and it is fetched once the browser is idle so a tap normally finds it
 * already there. `loading` gives the drawer its own Suspense boundary, as in `shortlist-panel-lazy`.
 */
const loadOperatorSwitcher = () => import("./operator-switcher-modal");

export const OperatorSwitcherModal = dynamic(() => loadOperatorSwitcher().then((m) => m.OperatorSwitcherModal), {
  ssr: false,
  loading: () => null,
});

preloadWhenIdle(loadOperatorSwitcher);
