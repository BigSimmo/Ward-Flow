"use client";

// RQ9 (Josh, 3 Nov 2026): mounted once in the ward layout. Shows the Referral sheet for whatever
// `openReferralRecord` asked for. The sheet's code loads on the first open, not with the page.

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { useEffect, useState } from "react";

import { subscribeReferralRecord, type ReferralRecordRequest } from "./referral-sheet-bus";

const ReferralSheetRecord = dynamic(
  withLoadRetry(() => import("./referral-sheet-record").then((m) => m.default)),
  { ssr: false },
);

export function ReferralSheetHost() {
  const [request, setRequest] = useState<ReferralRecordRequest | null>(null);
  useEffect(() => subscribeReferralRecord(setRequest), []);
  if (!request) return null;
  return <ReferralSheetRecord referralId={request.referralId} tab={request.tab} onClose={() => setRequest(null)} />;
}
