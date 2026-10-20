"use client";

// Shown only when an accepted direct referral awaits its journey, so the form (with its legal
// status and legal form lists) loads when first needed and stays out of the ward page's first
// script, keeping the phone budget.

import dynamic from "next/dynamic";

export const WardAcceptedReferralPlacement = dynamic(
  () => import("./ward-accepted-referral-placement-form").then((m) => m.WardAcceptedReferralPlacementForm),
  { ssr: false },
);
