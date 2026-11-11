"use client";

import { ChipGroup, FilterChip } from "@/components/wf";

import { WARD_REOPEN_AFTER_HOURS } from "./capacity/ward-closure";
import styles from "./ward-closure-choice.module.css";

/** One closure choice as kit chips; the chosen id rides on `data-value` for the page and its tests. */
export function ClosureChoice({
  label,
  testId,
  value,
  items,
  onChange,
}: {
  label: string;
  testId: string;
  value: string;
  items: { id: string; label: string }[];
  onChange: (next: string) => void;
}) {
  return (
    <div className={styles.choice} data-testid={testId} data-value={value}>
      <p className={styles.subheading} aria-hidden="true">
        {label}
      </p>
      <ChipGroup label={label} className={styles.chips}>
        {items.map((item) => (
          <FilterChip
            key={item.id}
            pressed={item.id === value}
            onPressedChange={(pressed) => onChange(pressed ? item.id : "")}
          >
            {item.label}
          </FilterChip>
        ))}
      </ChipGroup>
    </div>
  );
}

/**
 * Item 6 (10 Nov 2026): "Review in" on a bed closure. "Not known" is the default and leaves the
 * review time out; the hours are the whole ward's reopening choices (`WARD_REOPEN_AFTER_HOURS`).
 */
export const REVIEW_AFTER_CHOICES: { id: string; label: string }[] = [
  { id: "", label: "Not known" },
  ...WARD_REOPEN_AFTER_HOURS.map((hours) => ({ id: String(hours), label: `In ${hours} hours` })),
];

/** The review time a "Review in" choice stands for, or `undefined` for "Not known". */
export function reviewAtFrom(choice: string, now: number): number | undefined {
  return choice === "" ? undefined : now + Number(choice) * 60;
}
