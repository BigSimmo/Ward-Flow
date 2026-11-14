"use client";

// Home's row components (approved Home mock-up v7, 22 Oct 2026), shared by Home's My list and the
// Alerts page's accepted-to-pull rows, so both draw an act-now row the same way.

import { useRef, type ReactNode, type RefObject } from "react";
import Link from "next/link";

import alertStyles from "@/components/ward-management/alerts/alerts.module.css";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { Badge, StatusGlyph } from "@/components/wf";

import styles from "./home-list.module.css";

/**
 * CB-3 (axe 4.14 label-content-name-mismatch): the open control's name holds its visible text (the
 * person's name, which every open label says), and the row's status follows when the label does not
 * already say it ("Accepted, bed not pulled"), so a screen reader hears it on the control.
 */
function rowOpenName(openLabel: string, title: string): string {
  return openLabel.toLowerCase().includes(title.toLowerCase()) ? openLabel : `${openLabel}: ${title}`;
}

/**
 * The row's open control is the person's name (home mock-up, FS-6): focus after a pull lands on it,
 * and its name still says what opening does and the row's status (CB-3).
 */
function NameOpen({
  className,
  name,
  title,
  openLabel,
  selected,
  onOpen,
  href,
  linkRef,
}: {
  className: string;
  name: string;
  title: string;
  openLabel: string;
  selected: boolean;
  onOpen?: () => void;
  href?: string;
  linkRef: RefObject<HTMLAnchorElement | null>;
}) {
  const label = rowOpenName(openLabel, title);
  return href ? (
    <Link ref={linkRef} href={href} className={className} aria-label={label}>
      {name}
    </Link>
  ) : (
    <button
      type="button"
      className={className}
      aria-current={selected ? "true" : undefined}
      aria-label={label}
      onClick={onOpen}
    >
      {name}
    </button>
  );
}

/**
 * Home's desktop row: glyph, a two-line body (who with the status tag, then where), how long, one
 * action. Text wraps instead of being cut, and the owner shows only when it is someone other than you.
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
  /** Opens a page rather than Placement: the name is then a link, and the row click follows it. */
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
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the row click is a pointer shortcut, and its own name button is the keyboard route
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
      {/* Josh's notes 4 (9 Nov 2026); wave 4 FS-6: who first with what is wrong as a filled tag on
          the same line (it wraps under the name when tight), then where; the time and the one action
          share the end column, so the text keeps the row's width. */}
      <span className={styles.hrowMain}>
        <span className={styles.hrowWho}>
          <NameOpen
            className={`${styles.hrowName} ${styles.hrowNameOpen}`}
            name={name}
            title={title}
            openLabel={openLabel}
            selected={selected}
            onOpen={onOpen}
            href={href}
            linkRef={linkRef}
          />{" "}
          <span className={styles.hrowUmrn}>{umrn}</span>
          {inlineTitle ? null : (
            <Badge size="sm" className={styles.hrowTag}>
              {title}
            </Badge>
          )}
        </span>
        <span className={styles.hrowLine}>
          {inlineTitle ? (
            <>
              <strong className={styles.hrowTitleInline}>{title}</strong>
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
  inlineTitle = false,
  age,
  ageNote,
  note,
  owner,
  action,
  endAction = false,
}: {
  data: Record<string, string | undefined>;
  tone: "danger" | "warning" | "info" | "neutral";
  act: boolean;
  selected: boolean;
  title: string;
  openLabel: string;
  onOpen?: () => void;
  /** Opens a page rather than Placement: the name is then a link, and the row click follows it. */
  href?: string;
  name: string;
  umrn: string;
  line: string;
  /** Notes items 5 and 6: the title leads the one plain place line instead of a tag of its own. */
  inlineTitle?: boolean;
  age: string | undefined;
  /** FS-8 (home-390 mock): the words after the age ("overdue", "since 10:37", "Time not recorded"). */
  ageNote?: string;
  /** A line of its own for a passed legal form's typed time, too long for the age column. */
  note?: string;
  owner: string | undefined;
  /** Phone-first proposal: the row's one next step, the same button the desktop row shows. */
  action?: ReactNode;
  /** Notes item 5: a quiet end link (a referral's Decide) sits at the row's end, not under the lines. */
  endAction?: boolean;
}) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the row click is a pointer shortcut, and its own name button is the keyboard route
    <li
      className={`${alertStyles.phoneRow} ${styles.compactRow}`}
      data-act={act ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      data-end-action={endAction && action ? "true" : undefined}
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
        <span className={`${alertStyles.phoneRowLine} ${styles.compactWho}`}>
          <span className={alertStyles.who}>
            <NameOpen
              className={`${alertStyles.rowOpen} ${styles.phoneName}`}
              name={name}
              title={title}
              openLabel={openLabel}
              selected={selected}
              onOpen={onOpen}
              href={href}
              linkRef={linkRef}
            />{" "}
            <strong className={`${alertStyles.umrn} ${styles.phoneUmrn}`}>{umrn}</strong>
          </span>
        </span>
        {/* Wave 4 (notes item 5, A5-15): the tag is a filled label that wraps, never "…". */}
        {inlineTitle ? null : (
          <Badge size="sm" className={`${styles.hrowTag} ${styles.phoneTag}`}>
            {title}
          </Badge>
        )}
        <span className={`${alertStyles.phoneRowLine} ${styles.compactWhere}`}>
          {inlineTitle ? (
            <>
              <strong className={styles.phoneTitleInline}>{title}</strong>
              {" · "}
            </>
          ) : null}
          {line}
        </span>
        {note ? <span className={`${alertStyles.phoneRowLine} ${styles.compactLine}`}>{note}</span> : null}
        {/* The owner sits in the text, not the end column, so a long team name never squeezes the title. */}
        {owner ? <span className={`${alertStyles.phoneRowLine} ${styles.compactLine}`}>{`With ${owner}`}</span> : null}
      </span>
      <span className={`${alertStyles.phoneRowEnd} ${styles.compactEnd}`}>
        <span className={alertStyles.phoneRowAge}>
          {age ?? ""}
          {ageNote ? <span className={styles.phoneAgeNote}>{ageNote}</span> : null}
        </span>
        {action ? <span className={styles.phoneRowAction}>{action}</span> : null}
      </span>
    </li>
  );
}
