"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { GroupHead, Icon, IconTile, PhoneSheet, StatusGlyph, buttonClass, cx } from "@/components/wf";

import styles from "./statistics-phone-body.module.css";

/*
 * Shared parts for the statistics sub-pages on a phone (v10 phone, 390 wide, 11 Oct 2026). They are
 * rendered only in the phone tree (`useIsPhone`), so the desktop cards never change. Every figure
 * they show is passed in from the screen's own derivations.
 */

/** The phone body under the hero: one column, 12px between groups. */
export function PhoneBody({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className={styles.body} data-testid={testId} data-ward-design="v10">
      {children}
    </div>
  );
}

/** A titled group on the canvas: a plain 14px title, a quiet note at the right, the content below. */
export function PhoneGroup({
  title,
  aside,
  label,
  children,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  /** The section's accessible name when the title is not a plain string. */
  label?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.group} aria-label={label ?? (typeof title === "string" ? title : undefined)}>
      {title ? <GroupHead title={title} aside={aside} variant="letter" className={styles.head} /> : null}
      {children}
    </section>
  );
}

/** A list card: the rows are `PhoneListRow as="li"`, with hairlines between. */
export function PhoneList({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <ul className={cx(styles.list, className)} aria-label={label}>
      {children}
    </ul>
  );
}

/** The last item of a capped list: "Show all 22" or "Show fewer". */
export function PhoneShowAll({ total, open, onToggle }: { total: number; open: boolean; onToggle: () => void }) {
  return (
    <li className={styles.showAllItem}>
      <button type="button" className={styles.showAll} aria-expanded={open} onClick={onToggle}>
        {open ? "Show fewer" : `Show all ${total}`}
      </button>
    </li>
  );
}

/**
 * The one-line key under a list whose rows carry an amber dot (phone review F-25, 15 Oct 2026),
 * so the dot's meaning is written down where it is used.
 */
export function PhoneDotKey({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p className={styles.dotKey} data-testid={testId}>
      <StatusGlyph tone="warning" size={9} />
      <span>{children}</span>
    </p>
  );
}

export type PhoneFact = {
  id: string;
  value: ReactNode;
  label: ReactNode;
  /** A short qualifier (why a figure is a dash, a count behind it), shown as its own muted line. */
  note?: ReactNode;
  testId?: string;
};

/** Figures as a two-column grid of tiles in one card, value over label (v10 phone). */
export function PhoneFacts({ facts, label, flush = false }: { facts: PhoneFact[]; label?: string; flush?: boolean }) {
  return (
    <dl className={cx(styles.facts, flush && styles.factsFlush)} aria-label={label}>
      {facts.map((fact) => (
        <div key={fact.id} className={styles.fact}>
          <dt>{fact.label}</dt>
          <dd data-testid={fact.testId}>{fact.value}</dd>
          {fact.note ? <dd className={styles.factNote}>{fact.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** A card with a small icon head (Weekly report cards). */
export function PhoneCard({
  icon,
  title,
  aside,
  children,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.card} aria-label={typeof title === "string" ? title : undefined}>
      <div className={styles.cardHead}>
        {icon ? <Icon icon={icon} size={16} /> : null}
        <b className={styles.cardTitle}>{title}</b>
        {aside ? <span className={styles.cardAside}>{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** A row that opens a sheet or another page: icon tile, title, one line, chevron. */
function PhoneNavRow({
  icon,
  title,
  sub,
  href,
  onSelect,
  testId,
}: {
  icon: LucideIcon;
  title: ReactNode;
  sub?: ReactNode;
  href?: string;
  onSelect?: () => void;
  testId?: string;
}) {
  const inner = (
    <>
      <IconTile icon={icon} />
      <span className={styles.navText}>
        <b>{title}</b>
        {sub ? <span>{sub}</span> : null}
      </span>
      <ChevronRight size={16} aria-hidden="true" className={styles.navGo} />
    </>
  );
  return href ? (
    <Link className={styles.navRow} href={href} data-testid={testId}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={styles.navRow} onClick={onSelect} aria-haspopup="dialog" data-testid={testId}>
      {inner}
    </button>
  );
}

/** A nav row whose target is a bottom sheet with its own body. */
export function PhoneSheetRow({
  icon,
  title,
  sub,
  sheetTitle,
  description,
  children,
  testId,
}: {
  icon: LucideIcon;
  title: string;
  sub?: ReactNode;
  sheetTitle?: string;
  description?: string;
  children: ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PhoneNavRow icon={icon} title={title} sub={sub} onSelect={() => setOpen(true)} testId={testId} />
      <PhoneSheet open={open} onClose={() => setOpen(false)} title={sheetTitle ?? title} description={description}>
        <div className={styles.sheetBody}>{children}</div>
      </PhoneSheet>
    </>
  );
}

/** The one primary action pinned at the foot of the phone screen ("Open the ward", "Print the report"). */
export function PhonePinnedAction({
  icon,
  children,
  href,
  onClick,
  testId,
}: {
  icon: LucideIcon;
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  testId?: string;
}) {
  const className = cx(buttonClass({ variant: "pri" }), styles.pinnedButton);
  return (
    <div className={styles.pinned} data-print-hide>
      {href ? (
        <Link href={href} className={className} data-testid={testId}>
          <Icon icon={icon} size={16} />
          {children}
        </Link>
      ) : (
        <button type="button" className={className} onClick={onClick} data-testid={testId}>
          <Icon icon={icon} size={16} />
          {children}
        </button>
      )}
    </div>
  );
}

export { styles as phoneBodyStyles };
