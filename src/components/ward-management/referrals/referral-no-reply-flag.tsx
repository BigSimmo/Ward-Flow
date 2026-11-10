"use client";

import { Badge, StatusGlyph } from "@/components/wf";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Referral } from "@/components/ward-management/ward-model";

import { noReplyLine, referralNoReplyWaits } from "./referral-no-reply";
import { NOT_OPENED_TAG, NOT_OPENED_TAG_MINUTES, referralNotOpenedUnitIds } from "./referral-not-opened";

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

/**
 * The "Not opened yet" tag (item 16, D-133): a ward sent this referral has no opened receipt after
 * the signed limit. A prompt only: the row keeps its place. Hidden while the receipts switch is off,
 * since no ward could then be shown as having opened it.
 */
export function ReferralNotOpenedTag({
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
  const flow = useOptionalWardFlowSelect("units");
  const enabled = useWardFeatureFlag("referral-opened-receipts");
  if (!flow || !enabled) return null;
  const unitIds = referralNotOpenedUnitIds(referral, now);
  if (!unitIds.length) return null;
  const wards = unitIds.map((id) => flow.units.find((unit) => unit.id === id)?.name ?? "A ward");
  return (
    <span className={className} data-testid={testId}>
      <Badge
        tone="neutral"
        size="sm"
        title={`Not opened by ${wards.join(", ")} after ${NOT_OPENED_TAG_MINUTES} minutes`}
      >
        {NOT_OPENED_TAG}
      </Badge>
    </span>
  );
}
