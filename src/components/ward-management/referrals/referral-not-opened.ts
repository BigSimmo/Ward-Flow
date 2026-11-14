import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import { isPastLimit } from "@/components/ward-management/ward-timed-rule";
import { isAwaitingAnswer } from "@/components/ward-management/ward-referrals";

/**
 * "NOT OPENED YET" (item 16, D-133, Josh 10 Nov 2026). A small worded tag on the coordinator's
 * referral list when a ward a referral was sent to has no "Opened by" receipt
 * (`ReferralAddressing.openedAt`, `MARK_REFERRAL_OPENED`) after `referralNotOpened` minutes.
 *
 * A prompt only. It re-routes, re-sorts, escalates and suggests nothing (D-71): the row keeps its
 * place and no ward is named as better. Only psychiatric ward copies carry an opened receipt, so
 * only they are read. A ward that has answered, been withdrawn or put the person on its waiting
 * list is not waiting to open it.
 */
export const NOT_OPENED_TAG_MINUTES = CLINICAL_VALUES.referralNotOpened.value;

export const NOT_OPENED_TAG = "Not opened yet";

/** The unit ids of the wards that were sent this referral and have not opened it after the limit. */
export function referralNotOpenedUnitIds(referral: Referral, now: Instant): string[] {
  const unitIds: string[] = [];
  for (const arm of referral.destinations) {
    // A legacy network-wide request names no ward, so no ward can open it.
    if (arm.destination.kind !== "psychiatric_ward" || arm.destination.unitId === undefined) continue;
    if (!isAwaitingAnswer(arm) || arm.openedAt !== undefined || arm.waitlistedAt !== undefined) continue;
    const sentAt = arm.referredAt ?? referral.raisedAt;
    if (!Number.isFinite(sentAt)) continue;
    if (isPastLimit(now - sentAt, NOT_OPENED_TAG_MINUTES)) unitIds.push(arm.destination.unitId);
  }
  return unitIds;
}
