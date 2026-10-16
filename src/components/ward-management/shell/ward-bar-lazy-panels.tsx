"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * F-10 (phone review, October 2026): the header's Referrals and Tasks drawers only draw while they
 * are open, but static imports put their code (about 120 KB, most of it the referral form) in the
 * shared chunk every Ward Flow page downloads and runs before it can respond. `WardBar` imports them
 * from here instead, so their code loads on its own and the first load stays smaller.
 *
 * Both are fetched once the page has loaded and the browser is idle, so a tap normally finds the
 * code already there. The tasks close button carries `data-sheet-autofocus`, so the Sheet still
 * moves focus to it if the code arrives after the tap.
 */
const loadReferralDrawer = () => import("@/components/ward-management/referrals/ward-referral-drawer");
const loadTasksDrawer = () => import("@/components/ward-management/ward-tasks-drawer");

export const WardReferralDrawer = dynamic(() => loadReferralDrawer().then((m) => m.WardReferralDrawer));
export const WardTasksDrawer = dynamic(() => loadTasksDrawer().then((m) => m.WardTasksDrawer));

preloadWhenIdle(loadReferralDrawer, loadTasksDrawer);
