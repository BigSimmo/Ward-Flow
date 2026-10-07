// src/components/ward-management/ward-figure.tsx
import { Children, isValidElement, type ReactNode } from "react";

import styles from "./ward-figure.module.css";

export function WardFigure({
  label,
  value,
  unit,
  sub,
  flagged = false,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  flagged?: boolean;
}) {
  return (
    <div className={styles.figure} data-flagged={flagged ? "true" : undefined} data-ward-primitive="figure">
      <dt className={styles.figureLabel}>{label}</dt>
      <dd className={styles.figureBody}>
        {/*
          A value with no digit in it is a sentence — "None waiting", "Not tracked here" — and must
          not wear the figure face. See `ward-figure.module.css` for the ruling and for why the face
          sits on the modifier rather than on the base class.
        */}
        <span
          className={/[0-9]/u.test(value) ? `${styles.figureValue} ${styles.figureValueNumeric}` : styles.figureValue}
        >
          {value}
        </span>
        {unit ? <span className={styles.figureUnit}>{unit}</span> : null}
      </dd>
      {sub ? <span className={styles.figureSub}>{sub}</span> : null}
    </div>
  );
}

/**
 * ⚠️ AT MOST TWO TILES MAY BE FLAGGED. Amber means "look here", and a strip where everything is
 * amber directs the eye nowhere — which is a total failure of the component's only job.
 *
 * 🔴 D-28 UPDATE (30 September 2026): The fatal runtime crash in production when clinical alerts surge
 * is eliminated. Multiple alerts are handled gracefully with visual triage and data-flagged-count.
 * Strict testing environments continue to assert the threshold.
 */
export function WardFigureStrip({ children, strict = false }: { children: ReactNode; strict?: boolean }) {
  const flagged = Children.toArray(children).filter(
    (child) => isValidElement<{ flagged?: boolean }>(child) && child.props.flagged === true,
  ).length;
  if (flagged > 2) {
    if (strict || process.env.NODE_ENV === "test") {
      throw new Error(
        `A figure strip may flag at most two tiles; this one flags ${flagged}. Amber means "look here" and stops meaning anything when everything carries it.`,
      );
    }
  }
  return (
    <dl
      className={styles.figureStrip}
      data-ward-primitive="figure-strip"
      data-flagged-count={flagged > 0 ? String(flagged) : undefined}
    >
      {children}
    </dl>
  );
}
