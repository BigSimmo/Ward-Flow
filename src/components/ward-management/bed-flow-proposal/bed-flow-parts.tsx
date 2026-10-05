import type { ReactNode } from "react";

import {
  RELEASE_BAND_LABELS,
  type ReleaseCounts,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import { RELEASE_BANDS } from "@/components/ward-management/ward-bed-availability";

import styles from "./bed-flow-proposal.module.css";

/**
 * Quiet building blocks for the Capacity and Network proposal (second pass, 5 October 2026):
 * flat sections on the page ground with hairline rules, one raised surface only for a side sheet,
 * colour only where it carries a warning.
 */

export function Section({
  title,
  question,
  meta,
  foot,
  raised = false,
  children,
}: {
  title: string;
  question?: string;
  meta?: ReactNode;
  foot?: ReactNode;
  raised?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={raised ? styles.sheet : styles.section} aria-label={title}>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {question ? <p className={styles.sectionQuestion}>{question}</p> : null}
        </div>
        {meta ? <div className={styles.sectionMeta}>{meta}</div> : null}
      </div>
      {children}
      {foot ? <div className={styles.sectionFoot}>{foot}</div> : null}
    </section>
  );
}

export type Figure = { label: string; value: ReactNode; note?: ReactNode; tone?: "danger" | "good" };

/** One row of headline figures, separated by hairlines rather than boxed. */
export function Figures({ items, label }: { items: Figure[]; label: string }) {
  return (
    <dl className={styles.figures} aria-label={label}>
      {items.map((item) => (
        <div key={item.label} className={styles.figure}>
          <dt>{item.label}</dt>
          <dd
            className={item.tone === "danger" ? styles.dangerText : item.tone === "good" ? styles.goodText : undefined}
          >
            {item.value}
          </dd>
          {item.note ? <dd className={styles.figureNote}>{item.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

export type Concern = { tone: "danger" | "warn" | "info"; label: string; href?: string };

/** The answer first, as plain text, then what needs attention as a flat list with small dots. */
export function Answer({ children, concerns = [] }: { children: ReactNode; concerns?: Concern[] }) {
  const dot = { danger: styles.dotDanger, warn: styles.dotWarn, info: styles.dotInfo };
  return (
    <section className={styles.answer} aria-label="Summary">
      <p className={styles.answerText}>{children}</p>
      {concerns.length ? (
        <ul className={styles.concerns} aria-label="Needs attention">
          {concerns.map((item) => (
            <li key={item.label}>
              <span className={`${styles.dot} ${dot[item.tone]}`} aria-hidden="true" />
              {item.href ? (
                <a className={styles.textLink} href={item.href}>
                  {item.label}
                </a>
              ) : (
                item.label
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Supporting facts as one grey line: "a · b · c". Empty parts are dropped. */
export function FactLine({ parts }: { parts: ReactNode[] }) {
  const shown = parts.filter((part) => part !== null && part !== false && part !== undefined && part !== "");
  return (
    <span className={styles.factLine}>
      {shown.map((part, index) => (
        <span key={index}>
          {index > 0 ? " · " : ""}
          {part}
        </span>
      ))}
    </span>
  );
}

/**
 * When beds come free, as a flat list: one row per time band with a thin bar, solid for confirmed
 * and outlined for expected. Expected discharges dated on an earlier day are named apart in grey;
 * they are not counted as beds coming free.
 */
export function ReleaseList({ releases, pastHref }: { releases: ReleaseCounts; pastHref?: string }) {
  const max = Math.max(1, ...RELEASE_BANDS.map((band) => releases[band].confirmed + releases[band].expected));
  const overdue = releases.overdue.expected;
  return (
    <>
      <ul className={styles.releaseRows}>
        {RELEASE_BANDS.map((band) => {
          const { confirmed, expected } = releases[band];
          return (
            <li key={band} className={styles.releaseRow}>
              <span>{RELEASE_BAND_LABELS[band]}</span>
              <span className={styles.gapTrack} aria-hidden="true">
                {confirmed ? (
                  <span className={styles.releaseConfirmed} style={{ width: `${(confirmed / max) * 100}%` }} />
                ) : null}
                {expected ? (
                  <span className={styles.releaseExpected} style={{ width: `${(expected / max) * 100}%` }} />
                ) : null}
              </span>
              <strong>{confirmed + expected}</strong>
              <span className={styles.factLine}>
                {confirmed} confirmed · {expected} expected
              </span>
            </li>
          );
        })}
      </ul>
      <p className={styles.note}>
        <span className={styles.keySolid} aria-hidden="true" /> Confirmed{" "}
        <span className={styles.keyOutline} aria-hidden="true" /> Expected
      </p>
      {overdue ? (
        <p className={styles.note}>
          Not counted: {overdue} expected {overdue === 1 ? "discharge" : "discharges"} dated on an earlier day and not
          confirmed.{" "}
          {pastHref ? (
            <a className={styles.textLink} href={pastHref}>
              Who is past their date
            </a>
          ) : null}
        </p>
      ) : null}
    </>
  );
}
