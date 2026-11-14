import type { Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import { isReferralOverdue } from "@/components/ward-management/ward-referrals";
import { StatusGlyph, type WfTone } from "@/components/wf";
import styles from "./referrals.module.css";

/*
 * Moved out of referral-board.tsx unchanged (26 September 2026) so referral-match.tsx can use them
 * without importing the board, which itself imports referral-match.tsx: that import cycle failed
 * tests/architecture-boundaries.test.ts ("has no runtime import cycles").
 */
export type ReferralPriority = "overdue" | "urgent" | "routine";

export function getReferralPriority(referral: Referral, now: Instant): ReferralPriority {
  // Josh's own defaults, not legal limits (D-22, D-24), shared with Home through ward-referrals.
  const isOverdue = isReferralOverdue(referral, now);
  if (isOverdue) return "overdue";
  if (referral.urgency === 1 || referral.urgency === 2) return "urgent";
  return "routine";
}

export function referralPriorityLabel(priority: ReferralPriority): string {
  switch (priority) {
    case "overdue":
      return "Overdue";
    case "urgent":
      return "Urgent";
    case "routine":
      return "Routine";
  }
}

/** Design audit 4 (5 Nov 2026): the kit StatusGlyph, one shape per tone, not hand-drawn marks. */
const PRIORITY_TONE: Record<ReferralPriority, WfTone> = { overdue: "danger", urgent: "warning", routine: "neutral" };

export function PriorityGlyph({ priority }: { priority: ReferralPriority }) {
  return <StatusGlyph tone={PRIORITY_TONE[priority]} size={12} className={styles.priorityIcon} />;
}
