"use client";

import { useSyncExternalStore, type ReactNode } from "react";

import { cx } from "@/components/wf";
import { calendarDateOf, formatInstant, type Instant } from "@/components/ward-management/ward-clock";

import styles from "./reports.module.css";

/**
 * Parts shared by the report pages (downtime pack and patient chronology). Page-local for the v10
 * build; the hero chip is a candidate for `@/components/wf` once a second group needs it.
 */

const PHONE_QUERY = "(max-width: 48rem)";

/** Phone is its own layout, not a reflow: the report renders a different tree under 48rem. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
      const query = window.matchMedia(PHONE_QUERY);
      query.addEventListener?.("change", notify);
      return () => query.removeEventListener?.("change", notify);
    },
    () => typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

/** "Sat 10 Oct", the report date form (no commas). */
export function reportDay(instant: Instant, dayZero: Date): string {
  const date = calendarDateOf(instant, dayZero);
  const weekday = date.toLocaleDateString("en-AU", { weekday: "short", timeZone: "Australia/Perth" });
  const day = date.toLocaleDateString("en-AU", { day: "numeric", timeZone: "Australia/Perth" });
  const month = date.toLocaleDateString("en-AU", { month: "short", timeZone: "Australia/Perth" });
  return `${weekday} ${day} ${month}`;
}

/** "Sat 10 Oct 10:42". */
export function reportMoment(instant: Instant, dayZero: Date): string {
  return `${reportDay(instant, dayZero)} ${formatInstant(instant)}`;
}

/**
 * A count chip on the hero band: mono figure, then its words. With `onPress` it is a button that
 * jumps or toggles (`pressed`); without, a plain chip. `twin` is a small signed change beside the
 * figure (the downtime pack's change since the last pack).
 */
export function HeroChip({
  value,
  label,
  twin,
  twinLabel,
  onPress,
  pressed,
  testId,
}: {
  value: ReactNode;
  label: ReactNode;
  twin?: ReactNode;
  /** Words for the twin, read by screen readers ("2 more since the last pack"). */
  twinLabel?: string;
  onPress?: () => void;
  pressed?: boolean;
  testId?: string;
}) {
  const body = (
    <>
      <span className={styles.chipValue}>{value}</span>
      {twin !== undefined ? (
        <span className={styles.chipTwin} aria-hidden={twinLabel ? true : undefined}>
          {twin}
        </span>
      ) : null}
      <span className={styles.chipLabel}>{label}</span>
      {twinLabel ? <span className={styles.srOnly}>, {twinLabel}</span> : null}
    </>
  );
  if (!onPress) {
    return (
      <span className={styles.chip} data-testid={testId}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cx(styles.chip, styles.chipButton)}
      aria-pressed={pressed}
      onClick={onPress}
      data-testid={testId}
    >
      {body}
    </button>
  );
}

/** The row of hero chips, one line on desktop; it scrolls sideways rather than wrapping. */
export function HeroChips({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {children}
    </div>
  );
}

/** Two by two facts for a phone sheet or a side panel. */
export function FactGrid({ facts }: { facts: Array<{ id: string; label: string; value: ReactNode }> }) {
  return (
    <dl className={styles.factGrid}>
      {facts.map((fact) => (
        <div key={fact.id} className={styles.fact}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
