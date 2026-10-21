"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Phone script budget (21 October 2026): the referral history and corrections list only draws on
 * the Timeline tab, or after a phone taps Show timeline, so `ReferralBoard` imports it from here and
 * the Referrals first load skips its code. It is fetched once the browser is idle, so opening the
 * timeline normally finds it already there.
 */
const loadReferralHistory = () => import("./referral-history-corrections");

export const ReferralHistoryAndCorrections = dynamic(
  () => loadReferralHistory().then((m) => m.ReferralHistoryAndCorrections),
  { loading: () => null },
);

preloadWhenIdle(loadReferralHistory);
