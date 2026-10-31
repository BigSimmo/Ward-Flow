"use client";

import dynamic from "next/dynamic";

import { withLoadRetry } from "../load-retry";
import { preloadWhenIdle } from "../preload-when-idle";
import { isReferralSheetPath } from "./ward-bar-model";

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
// Phone size trim (31 Oct 2026): the Activity sheet's list only draws while the sheet is open.
const loadActivityBody = () => import("./ward-bar-activity");

// Offline (22 Oct 2026): a failed fetch shows Try again and Close instead of crashing the page.
export const WardReferralDrawer = dynamic(
  withLoadRetry(() => loadReferralDrawer().then((m) => m.WardReferralDrawer), "Referrals did not load"),
);
export const WardTasksDrawer = dynamic(
  withLoadRetry(() => loadTasksDrawer().then((m) => m.WardTasksDrawer), "Tasks and alerts did not load"),
);

export const WardBarActivityBody = dynamic(
  withLoadRetry(() => loadActivityBody().then((m) => m.WardBarActivityBody), "Activity did not load"),
);

// DA-13: on the new-referral route the form opens as soon as the page can respond, so its code
// is fetched while the page is still starting instead of after it, when the drawer asks for it.
if (typeof window !== "undefined" && isReferralSheetPath(window.location.pathname))
  void loadReferralDrawer().catch(() => undefined);

preloadWhenIdle(loadReferralDrawer, loadTasksDrawer, loadActivityBody);
