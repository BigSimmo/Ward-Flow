/**
 * Plain words for referral documents, kept apart from `referral-document-links.tsx` so screens that
 * only need a label do not load the referral drawer's stylesheet (#1467).
 */
import type { ReferralChart } from "./referral-submission";

export function documentLabel(kind: ReferralChart["kind"]) {
  return kind === "medication"
    ? "Medication chart"
    : kind === "observation"
      ? "Observation chart"
      : "Additional document";
}

/** "2 attached" or "1 attached, 1 to follow" (A27). */
export function chartsCountText(attached: number, toFollow: number): string {
  return toFollow ? `${attached} attached, ${toFollow} to follow` : `${attached} attached`;
}
