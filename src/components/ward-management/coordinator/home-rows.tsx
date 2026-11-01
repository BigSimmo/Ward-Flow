"use client";

// Home's row components (approved Home mock-up v7, 22 Oct 2026), shared by Home's My list and the
// Alerts page's accepted-to-pull rows, so both draw an act-now row the same way.

import { useRef, type ReactNode } from "react";
import Link from "next/link";

import alertStyles from "@/components/ward-management/alerts/alerts.module.css";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { StatusGlyph } from "@/components/wf";

import styles from "./home-list.module.css";

/**
 * Home's desktop row: glyph, a two-line body (what, then who and where), how long, one action. Text
 * wraps instead of being cut, and the owner shows only when it is someone other than you.
 */
export function HomeRow({
  data,
  tone,
  act,
  selected,
  title,
  openLabel,
  onOpen,
  href,
  name,
  umrn,
  where,
  extra,
  age,
  ageNote,
  action,
}: {
  data: Record<string, string | undefined>;
  tone: "danger" | "warning" | "info" | "neutral";
  act: boolean;
  selected: boolean;
  title: string;
  openLabel: string;
  onOpen?: () => void;
  /** Opens a page rather than Placement: the title is then a link, and the row click follows it. */
  href?: string;
  name: string;
  umrn: string;
  where: string;
  extra?: string;
  age: string | undefined;
  ageNote: string;
  action: ReactNode;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the row click is a pointer shortcut, and its own button is the keyboard route
    <li
      className={styles.hrow}
      data-act={act ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        if (href) linkRef.current?.click();
        else onOpen?.();
      }}
      {...data}
    >
      <span className={styles.hrowGlyph}>
        <StatusGlyph tone={tone} />
      </span>
      <span className={styles.hrowMain}>
        {href ? (
          <Link ref={linkRef} href={href} className={styles.hrowTitle} aria-label={openLabel}>
            {title}
          </Link>
        ) : (
          <button
            type="button"
            className={styles.hrowTitle}
            aria-current={selected ? "true" : undefined}
            aria-label={openLabel}
            onClick={onOpen}
          >
            {title}
          </button>
        )}
        <span className={styles.hrowLine}>
          <strong className={styles.hrowName}>{name}</strong> <span className={styles.mono}>{umrn}</span>
          <span className={styles.hrowWhere}>
            {" · "}
            <SpelledCodes text={where} />
          </span>
        </span>
        {extra ? <span className={styles.hrowExtra}>{extra}</span> : null}
      </span>
      <span className={styles.hrowAge}>
        {age === undefined ? null : <span className={styles.mono}>{age}</span>}
        <span>{ageNote}</span>
      </span>
      <span className={styles.hrowAction}>{action}</span>
    </li>
  );
}

export /** Home's phone row: the Alerts phone row layout, with the owner named only when it is not you. */
function PhoneRow({
  data,
  tone,
  act,
  selected,
  title,
  openLabel,
  onOpen,
  href,
  name,
  umrn,
  line,
  age,
  note,
  owner,
}: {
  data: Record<string, string | undefined>;
  tone: "danger" | "warning" | "info" | "neutral";
  act: boolean;
  selected: boolean;
  title: string;
  openLabel: string;
  onOpen?: () => void;
  /** Opens a page rather than Placement: the title is then a link, and the row click follows it. */
  href?: string;
  name: string;
  umrn: string;
  line: string;
  age: string | undefined;
  /** A line of its own for a passed legal form's typed time, too long for the age column. */
  note?: string;
  owner: string | undefined;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the row click is a pointer shortcut, and its own button is the keyboard route
    <li
      className={`${alertStyles.phoneRow} ${styles.compactRow}`}
      data-act={act ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        if (href) linkRef.current?.click();
        else onOpen?.();
      }}
      {...data}
    >
      <span className={alertStyles.phoneRowGlyph}>
        <StatusGlyph tone={tone} />
      </span>
      <span className={`${alertStyles.phoneRowText} ${styles.compactText}`}>
        {href ? (
          <Link
            ref={linkRef}
            href={href}
            className={`${alertStyles.rowOpen} ${styles.compactTag}`}
            aria-label={openLabel}
          >
            <span className={alertStyles.rowOpenText}>{title}</span>
          </Link>
        ) : (
          <button
            type="button"
            className={`${alertStyles.rowOpen} ${styles.compactTag}`}
            aria-current={selected ? "true" : undefined}
            aria-label={openLabel}
            onClick={onOpen}
          >
            <span className={alertStyles.rowOpenText}>{title}</span>
          </button>
        )}
        <span className={`${alertStyles.phoneRowLine} ${styles.compactWho}`}>
          <span className={alertStyles.who}>
            <strong className={alertStyles.name}>{name}</strong> <strong className={alertStyles.umrn}>{umrn}</strong>
          </span>
        </span>
        <span className={`${alertStyles.phoneRowLine} ${styles.compactWhere}`}>{line}</span>
        {note ? <span className={`${alertStyles.phoneRowLine} ${styles.compactLine}`}>{note}</span> : null}
        {/* The owner sits in the text, not the end column, so a long team name never squeezes the title. */}
        {owner ? <span className={`${alertStyles.phoneRowLine} ${styles.compactLine}`}>{`With ${owner}`}</span> : null}
      </span>
      <span className={`${alertStyles.phoneRowEnd} ${styles.compactEnd}`}>
        <span className={alertStyles.phoneRowAge}>{age ?? ""}</span>
      </span>
    </li>
  );
}
