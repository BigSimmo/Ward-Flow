"use client";

import { StatusGlyph } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Referral } from "@/components/ward-management/ward-model";

import { noReplyLine, referralNoReplyWaits } from "./referral-no-reply";

/**
 * The "Stuck: no reply" flag on a waiting referral's row (item 17). A highlight only: it never
 * moves the row, and outside a provider it shows nothing.
 */
export function ReferralNoReplyFlag({
  referral,
  now,
  className,
  testId,
}: {
  referral: Referral;
  now: Instant;
  className?: string;
  testId: string;
}) {
  const flow = useOptionalWardFlowSelect("configuration", "units");
  if (!flow) return null;
  const line = noReplyLine(referralNoReplyWaits(referral, now, flow.configuration, flow.units));
  if (!line) return null;
  return (
    <span className={className} data-testid={testId}>
      <StatusGlyph tone="danger" size={8} /> {line}
    </span>
  );
}
