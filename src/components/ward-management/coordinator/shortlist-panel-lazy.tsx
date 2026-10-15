"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Fix list 7.2 (October 2026): the shortlist and placement panels are Home's largest code (about
 * 40 KB), yet a phone opens Home without either on screen: they only draw once someone picks a
 * patient or referral. `CoordinatorScreen` imports them from here, so a phone's first load skips
 * that code. A desktop still draws the preview on the server, and the code is fetched once the
 * browser is idle so a tap normally finds it already there.
 */
const loadShortlistPanel = () => import("./shortlist-panel");

export const ShortlistPanel = dynamic(() => loadShortlistPanel().then((m) => m.ShortlistPanel));
export const ReferralPlacementPanel = dynamic(() => loadShortlistPanel().then((m) => m.ReferralPlacementPanel));

preloadWhenIdle(loadShortlistPanel);
