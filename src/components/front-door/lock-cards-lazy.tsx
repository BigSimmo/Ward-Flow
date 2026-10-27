"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";

import doorStyles from "./front-door.module.css";

/**
 * The idle prompts, out of the phone's first load like the front door. They are fetched once the
 * page is idle, long before the first prompt is due. Until they arrive the lock still covers the
 * desk with the navy screen, so a slow or failed fetch never leaves patients on show.
 */
const loadLockCards = () => import("./lock-cards");

export const IdleWarningSheet = dynamic(() => loadLockCards().then((module) => module.IdleWarningSheet), {
  ssr: false,
  loading: () => null,
});

export const IdleLockScreen = dynamic(() => loadLockCards().then((module) => module.IdleLockScreen), {
  ssr: false,
  loading: () => <div className={doorStyles.screen} aria-busy="true" />,
});

preloadWhenIdle(loadLockCards);
