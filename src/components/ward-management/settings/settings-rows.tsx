"use client";

import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";

import { SrOnly, StatusGlyph, Stepper, cx } from "@/components/wf";

import styles from "./settings.module.css";

/** D4 wording for every control the engine cannot back yet. */
export const NOT_WIRED = "Not wired in this prototype.";

/** Marks a setting shown for review that nothing reads yet. Screen readers hear the D4 sentence. */
export function PreviewTag() {
  return (
    <span className={styles.previewTag} title={NOT_WIRED}>
      Preview
      <SrOnly>. {NOT_WIRED}</SrOnly>
    </span>
  );
}

/** One line under the band per tab: whether its changes wait for Save or apply at once. */
export function ScopeLine({ kind }: { kind: "save" | "live" }) {
  return (
    <p className={styles.scopeLine}>
      {kind === "save" ? (
        // Not a checked chip: nothing is unsaved until a rule changes (device audit 11 Oct 2026).
        <span className={styles.scopeTag}>Save to apply</span>
      ) : (
        <span className={styles.scopeTag}>
          <StatusGlyph tone="success" size={8} />
          Applies now
        </span>
      )}
      <span>
        {kind === "save"
          ? "Rules change what every screen shows. Each save is recorded in the audit."
          : "Preferences for this browser."}
      </span>
    </p>
  );
}

/** A labelled setting: name and short line on the left, its control on the right. */
export function SettingRow({
  setting,
  title,
  sub,
  subTestId,
  preview = false,
  stacked = false,
  testId,
  children,
}: {
  /** Find a setting target (`data-setting`). */
  setting: string;
  title: ReactNode;
  sub?: ReactNode;
  subTestId?: string;
  /** `"quiet"` when the card head already carries the visible tag: screen readers still hear D4. */
  preview?: boolean | "quiet";
  /** Control sits under the words (chip groups). */
  stacked?: boolean;
  testId?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx(styles.row, stacked && styles.rowStacked)} data-setting={setting} data-testid={testId}>
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>
          {title}
          {preview === true ? <PreviewTag /> : null}
          {preview === "quiet" ? <SrOnly>. {NOT_WIRED}</SrOnly> : null}
        </span>
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
  preview = false,
  previewTag = preview,
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
  preview?: boolean;
  /** Off when the card head already carries the Preview tag. */
  previewTag?: boolean;
  unavailableReason?: string;
}) {
  const changed = !preview && value !== saved;
  return (
    <div
      className={cx(styles.ruleRow, changed && styles.ruleChanged)}
      data-setting={setting}
      data-testid={testId}
      data-changed={changed || undefined}
    >
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>
          {title}
          {previewTag ? <PreviewTag /> : null}
          {preview && !previewTag ? <SrOnly>. {NOT_WIRED}</SrOnly> : null}
        </span>
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
        {changed ? (
          <span className={styles.changedTag}>
            Changed<SrOnly>, saved value {savedDisplay ?? saved}</SrOnly>
          </span>
        ) : null}
      </span>
      <span className={styles.effectCell}>
        {/* Site review (12 Oct 2026): plain words, no build notes. A Preview rule's card says it is
            not wired once, so its row adds nothing here. */}
        {!preview && effect ? <span className={styles.effectLine}>{effect}</span> : null}
        {usedBy ? (
          <span className={styles.usedBy} title={shownOn(usedBy)}>
            {shownOn(usedBy)}
          </span>
        ) : null}
      </span>
    </div>
  );
}
