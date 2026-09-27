import type { Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import {
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";
import { referralClocks } from "@/components/ward-management/ward-referrals";
import styles from "./referrals.module.css";

/*
 * Moved out of referral-board.tsx unchanged (26 September 2026) so referral-match.tsx can use them
 * without importing the board, which itself imports referral-match.tsx: that import cycle failed
 * tests/architecture-boundaries.test.ts ("has no runtime import cycles").
 */
export type ReferralPriority = "overdue" | "urgent" | "routine";

export function getReferralPriority(referral: Referral, now: Instant): ReferralPriority {
  const clocks = referralClocks(referral, now);
  // Josh's own defaults, not legal limits (D-22, D-24): the same figures the intake form and the
  // settings screen quote, read from one place so they cannot drift apart.
  const isOverdue =
    clocks.sinceReferralRunning &&
    (clocks.sinceReferral >= OVERDUE_AFTER_MINUTES_BY_TIER[referral.urgency] ||
      clocks.sinceReferral >= OVERDUE_AFTER_ANY_TIER_MINUTES);

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

export function PriorityGlyph({ priority }: { priority: ReferralPriority }) {
  switch (priority) {
    case "overdue":
      return (
        <svg
          className={styles.priorityIcon}
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="8" cy="8" r="6" />
          <polyline points="8 4 8 8 11 9.5" />
        </svg>
      );
    case "urgent":
      return (
        <svg
          className={styles.priorityIcon}
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden="true"
          fill="currentColor"
        >
          <path d="M8 1.5 1 14h14L8 1.5ZM8 5a.9.9 0 0 1 .9.9v3.4a.9.9 0 0 1-1.8 0V5.9A.9.9 0 0 1 8 5Zm0 6.8a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
        </svg>
      );
    case "routine":
      return (
        <svg
          className={styles.priorityIcon}
          viewBox="0 0 16 16"
          width="12"
          height="12"
          aria-hidden="true"
          fill="currentColor"
        >
          <circle cx="8" cy="8" r="4.5" />
        </svg>
      );
  }
}
