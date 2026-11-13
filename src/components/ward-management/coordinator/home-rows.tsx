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
 * CB-3 (axe 4.14 label-content-name-mismatch): the row's name must hold its visible title, so a
 * title the open label does not already say ("Accepted, bed not pulled") follows it.
 */
function rowOpenName(openLabel: string, title: string): string {
  return openLabel.toLowerCase().includes(title.toLowerCase()) ? openLabel : `${openLabel}: ${title}`;
}

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
  inlineTitle = false,
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
  /**
   * Wave 4 (notes item 6, A16-23): the title leads the place line in strong ink ("Tier 3 · Any
   * suitable ward · from Royal Perth ED · …"), one line instead of a tag over two more lines.
   */
  inlineTitle?: boolean;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the row click is a pointer shortcut, and its own button is the keyboard route
    <li
      className={`${styles.hrow} ${styles.hrowStacked}`}
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
      {/* Josh's notes 4 (9 Nov 2026): who first, then what is wrong as a quiet label, then where; the
          time and the one action share the end column, so the text keeps the row's width. */}
      <span className={styles.hrowMain}>
        <span className={styles.hrowWho}>
          <strong className={styles.hrowName}>{name}</strong> <span className={styles.hrowUmrn}>{umrn}</span>
        </span>
        {href ? (
          <Link ref={linkRef} href={href} className={styles.hrowTitle} aria-label={rowOpenName(openLabel, title)}>
            {title}
          </Link>
        ) : inlineTitle ? null : (
          <button
            type="button"
            className={styles.hrowTitle}
            aria-current={selected ? "true" : undefined}
            aria-label={rowOpenName(openLabel, title)}
            onClick={onOpen}
          >
            {title}
          </button>
        )}
        <span className={styles.hrowLine}>
          {inlineTitle && !href ? (
            <>
              <button
                type="button"
                className={styles.hrowTitleInline}
                aria-current={selected ? "true" : undefined}
                aria-label={rowOpenName(openLabel, title)}
                onClick={onOpen}
              >
                {title}
              </button>
              {" · "}
            </>
          ) : null}
          <SpelledCodes text={where} />
        </span>
        {extra ? <span className={styles.hrowExtra}>{extra}</span> : null}
      </span>
      <span className={styles.hrowEnd}>
        <span className={styles.hrowAge}>
          {age === undefined ? null : <span className={styles.mono}>{age}</span>}
          <span>{ageNote}</span>
        </span>
        <span className={styles.hrowAction}>{action}</span>
      </span>
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
  line: string;
  age: string | undefined;
  /** A line of its own for a passed legal form's typed time, too long for the age column. */
  note?: string;
  owner: string | undefined;
  /** Phone-first proposal: the row's one next step, the same button the desktop row shows. */
  action?: ReactNode;
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
            aria-label={rowOpenName(openLabel, title)}
          >
            <span className={alertStyles.rowOpenText}>{title}</span>
          </Link>
        ) : (
          <button
            type="button"
            className={`${alertStyles.rowOpen} ${styles.compactTag}`}
            aria-current={selected ? "true" : undefined}
            aria-label={rowOpenName(openLabel, title)}
            onClick={onOpen}
          >
            {/* Wave 4 (notes item 5, A5-15): the tag wraps on a phone, never "…". */}
            <span className={`${alertStyles.rowOpenText} ${styles.wrapTag}`}>{title}</span>
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
        {action ? <span className={styles.phoneRowAction}>{action}</span> : null}
      </span>
    </li>
  );
}
