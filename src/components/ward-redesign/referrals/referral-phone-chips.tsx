"use client";
// Copied from `ReferralPhoneChips` in src/components/ward-management/referrals/referral-board-phone.tsx.

import phone from "@/components/ward-management/referrals/referral-board-phone.module.css";
import type { PhoneChip } from "@/components/ward-management/referrals/referral-board-phone";

import styles from "./referrals-redesign.module.css";

/**
 * The highlight chips under the phone hero, the same chips as today. Josh, 30 Oct 2026: they wrap
 * onto a second row instead of scrolling sideways and ending in "0 Com…".
 */
export function ReferralPhoneChips({
  chips,
  highlight,
  onHighlight,
}: {
  chips: PhoneChip[];
  highlight: string | null;
  onHighlight: (key: string) => void;
}) {
  return (
    <div className={styles.phoneChips} role="group" aria-label="Highlight by what is asked">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={phone.chip}
          aria-pressed={highlight === chip.key}
          onClick={() => onHighlight(chip.key)}
          data-testid={`ward-referral-phone-chip-${chip.key}`}
        >
          <b>{chip.count}</b>
          {chip.label}
        </button>
      ))}
    </div>
  );
}
