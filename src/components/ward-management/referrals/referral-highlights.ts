// The Referrals board's highlight keys and tests, one place for the board and its top (page tops,
// 9 Nov 2026). Moved out of `referral-board.tsx` for its line cap.
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import { declinedAddressings } from "@/components/ward-management/ward-referrals";

import { isOverdue, openArms } from "./referral-board-parts";

export type HighlightKey = "overdue" | "tier1" | "ward" | "ed" | "both" | "community" | "refused";
export const HIGHLIGHT_KEYS: readonly HighlightKey[] = [
  "overdue",
  "tier1",
  "ward",
  "ed",
  "both",
  "community",
  "refused",
];

/**
 * The hero's highlight chips. Refused once sits in the queue toolbar. P154 (Josh, 27 October 2026,
 * option A): phone and desktop read the same type chips, Ward bed · ED · More than one · Community.
 */
export const HIGHLIGHT_LABELS: readonly (readonly [Exclude<HighlightKey, "refused">, string])[] = [
  ["overdue", "Decision overdue"],
  ["tier1", "Tier 1"],
  ["ward", "Ward bed"],
  ["ed", "ED"],
  ["both", "More than one"],
  ["community", "Community"],
];

/**
 * Audit round 2 (A2-13): the type chips count each referral once. A referral that asks for more
 * than one kind of place sits under More than one, not under each kind, so the chips sum to the
 * hero's "awaiting decision" count. P154: desktop pills use the same rule as the phone chips.
 */
function askedKinds(referral: Referral): Set<string> {
  return new Set(openArms(referral).map((arm) => arm.destination.kind));
}

function typeTest(key: "ward" | "ed" | "both" | "community", referral: Referral): boolean {
  const kinds = askedKinds(referral);
  if (key === "both") return kinds.size > 1;
  if (kinds.size !== 1) return false;
  const kind = key === "ward" ? "psychiatric_ward" : key === "ed" ? "emergency_department" : "community_team";
  return kinds.has(kind);
}

export function highlightTest(key: HighlightKey, referral: Referral, now: Instant): boolean {
  if (key === "ward" || key === "ed" || key === "both" || key === "community") {
    return typeTest(key, referral);
  }
  switch (key) {
    case "overdue":
      return isOverdue(referral, now);
    case "tier1":
      return referral.urgency === 1;
    case "refused":
      return declinedAddressings(referral).length > 0;
  }
}
