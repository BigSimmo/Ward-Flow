"use client";
// Fork of src/components/ward-management/settings/settings-rows.tsx: a read-only rule shows its value as text.

import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";

import { SrOnly, Stepper, cx } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-redesign.module.css";

/** A labelled setting: name and short line on the left, its control on the right. */
export function SettingRow({
  setting,
  title,
  sub,
  subTestId,
  stacked = false,
  testId,
  children,
}: {
  /** Find a setting target (`data-setting`). */
  setting: string;
  title: ReactNode;
  sub?: ReactNode;
  subTestId?: string;
  /** Control sits under the words (chip groups). */
  stacked?: boolean;
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx(styles.row, stacked && styles.rowStacked)} data-setting={setting} data-testid={testId}>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {sub ? (
          <span className={styles.rowSub} data-testid={subTestId}>
            {sub}
          </span>
        ) : null}
      </span>
      {children ? <span className={styles.rowControl}>{children}</span> : null}
    </div>
  );
}

/** "Home, ED, Movements" reads "Shown on Home, ED and Movements". */
function shownOn(pages: string): string {
  const list = pages
    .split(",")
    .map((page) => page.trim())
    .filter(Boolean);
  const last = list.pop();
  return `Shown on ${list.length ? `${list.join(", ")} and ${last}` : (last ?? "")}`;
}

export type RuleRange = {
  /** Names the written range line (`<id>-range`) for tests. */
  readonly id?: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly minLabel: string;
  readonly maxLabel: string;
};

/**
 * One coordination rule: words, the allowed range in words ("Range 12h to 36h"), a reset to the
 * saved value when changed, one stepper, and its effect and readers on the right.
 *
 * v10: one control per value. The stepper is the only control; the slider that once sat under it
 * is gone, and the range is written out instead. A value at the end of its range stops the
 * stepper there, which is the refusal and its reason in one.
 */
export function RuleRow({
  setting,
  title,
  sub,
  subTestId,
  testId,
  value,
  saved,
  display,
  displayTestId,
  noun,
  max,
  range,
  onChange,
  savedDisplay,
  onReset,
  effect,
  usedBy,
  unavailableReason,
}: {
  setting: string;
  title: string;
  sub: string;
  subTestId?: string;
  testId?: string;
  value: number;
  saved: number;
  display: string;
  displayTestId?: string;
  /** Stepper button names: "Decrease <noun>", "Increase <noun>". */
  noun: string;
  /** Stepper ceiling when it is tighter than the range (the first warning stays below the second). */
  max?: number;
  range: RuleRange;
  onChange: (value: number) => void;
  /** The saved value in words ("24h"), read with the Changed tag. */
  savedDisplay?: string;
  onReset?: () => void;
  effect?: ReactNode;
  usedBy?: string;
  unavailableReason?: string;
}) {
  const changed = value !== saved;
  return (
    <div
      className={cx(styles.ruleRow, changed && styles.ruleChanged)}
      data-setting={setting}
      data-testid={testId}
      data-changed={changed || undefined}
    >
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowSub} data-testid={subTestId}>
          {sub}
        </span>
        <span className={styles.rangeWords} data-testid={range.id ? `${range.id}-range` : undefined}>
          Range {range.minLabel} to {range.maxLabel}
        </span>
      </span>
      <span className={styles.resetCell}>
        {changed && onReset ? (
          <button
            type="button"
            className={styles.resetButton}
            onClick={onReset}
            aria-label={`Reset ${title.toLowerCase()} to saved`}
            title="Back to saved"
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        ) : null}
      </span>
      <span className={styles.ruleValue}>
        {/* Redesign (Josh, 30 Oct 2026): a rule this desk cannot change was a stepper with greyed
            buttons and the value lost in a near-empty box. It reads as the value in words now; the
            reason is on hover and for screen readers, and the band's "Read only" line says it once. */}
        {unavailableReason ? (
          <span className={rx.ruleReadValue} data-testid={displayTestId} title={unavailableReason}>
            {display}
            <SrOnly>. {unavailableReason}</SrOnly>
          </span>
        ) : (
          <Stepper
            className={styles.ruleStepper}
            value={value}
            onChange={(next) => {
              if (!unavailableReason) onChange(next);
            }}
            unavailable={!!unavailableReason}
            note={unavailableReason}
            min={range.min}
            max={max ?? range.max}
            step={range.step}
            noun={noun}
            valueText={display}
            display={display}
            valueTestId={displayTestId}
          />
        )}
        {changed ? (
          <span className={styles.changedTag}>
            Changed<SrOnly>, saved value {savedDisplay ?? saved}</SrOnly>
          </span>
        ) : null}
      </span>
      <span className={styles.effectCell}>
        {/* Site review (12 Oct 2026): plain words, no build notes. */}
        {effect ? <span className={styles.effectLine}>{effect}</span> : null}
        {usedBy ? (
          <span className={styles.usedBy} title={shownOn(usedBy)}>
            {shownOn(usedBy)}
          </span>
        ) : null}
      </span>
    </div>
  );
}
