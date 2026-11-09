"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Phone budget (9 Nov 2026): the alert notifier renders nothing and only acts once the session is
 * adopted, so it stays off every page's first load and is fetched when the browser is idle. It sets
 * its baseline when it mounts, so alerts already showing at load are never pushed as new.
 */
const loadNotifier = () => import("./ward-act-now-notifier");

export const WardActNowNotifier = dynamic(() => loadNotifier().then((m) => m.WardActNowNotifier), {
  ssr: false,
  loading: () => null,
});

preloadWhenIdle(loadNotifier);
