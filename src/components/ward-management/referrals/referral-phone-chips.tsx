"use client";
// Copied from `ReferralPhoneChips` in src/components/ward-management/referrals/referral-board-phone.tsx.

import phone from "./referral-board-phone.module.css";
import type { PhoneChip } from "./referral-board-phone";
import { cx, phoneRows as rows } from "@/components/wf";

/**
 * The highlight chips under the phone hero, the same chips as today. Josh, 31 Oct 2026: one row that
 * slides sideways in Home's style, with chips at 0 muted at the end, instead of wrapping onto two rows.
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
    <div className={cx(rows.chipRow)} role="group" aria-label="Highlight by what is asked">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={cx(phone.chip, rows.chip, chip.count === 0 && rows.zero)}
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
