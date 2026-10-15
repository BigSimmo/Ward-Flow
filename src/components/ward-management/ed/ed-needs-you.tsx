"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { type ReactNode, useId } from "react";

import { StatusGlyph, cx } from "@/components/wf";

import styles from "./ed-needs-you.module.css";

/**
 * ED page (device audit 11 Oct 2026, owner pick A2): one Needs you list that holds
 * only items needing action, with the thin red edge on act-now items. Good news (an acceptance,
 * someone leaving) stays on the board row and is not listed here.
 */
export type EdNeedsItem = {
  key: string;
  actNow: boolean;
  kind: string;
  person: string;
  when: string;
  actionLabel?: string;
  onAction?: () => void;
  onOpen?: () => void;
};

export function EdNeedsYou({
  items,
  framed = true,
  heading = "Needs you",
  className,
  ...data
}: {
  items: EdNeedsItem[];
  framed?: boolean;
  heading?: string;
  className?: string;
  "data-pane"?: string;
  "data-rail"?: string;
}) {
  const headingId = useId();
  return (
    <section
      className={cx(styles.card, framed && styles.framed, className)}
      aria-labelledby={headingId}
      data-testid="ward-ed-needs-you"
      {...data}
    >
      <div className={styles.head}>
        <h2 id={headingId}>{heading}</h2>
        <span className={styles.count}>{items.length === 0 ? "None" : items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className={styles.none}>Nothing needs action in this department.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.key} className={cx(styles.row, item.actNow && styles.actNow)}>
              <button type="button" className={styles.open} onClick={item.onOpen}>
                <StatusGlyph tone={item.actNow ? "danger" : "warning"} size={9} />
                <span className={styles.text}>
                  <b className={styles.kind}>{item.kind}</b>
                  <span className={styles.personLine}>
                    <span className={styles.person}>{item.person}</span>
                    <span className={styles.when}>{item.when}</span>
                  </span>
                </span>
              </button>
              {item.actionLabel && item.onAction ? (
                <button type="button" className={styles.action} onClick={item.onAction}>
                  {item.actionLabel}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** What the page no longer stacks under the board, as links to where each lives. */
export function EdElsewhereLinks({ links }: { links: { href: string; title: string; sub: ReactNode }[] }) {
  return (
    <nav className={cx(styles.card, styles.framed)} aria-label="Elsewhere" data-testid="ward-ed-elsewhere">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={styles.link}>
          <span className={styles.text}>
            <b className={styles.kind}>{link.title}</b>
            <span className={styles.person}>{link.sub}</span>
          </span>
          <ChevronRight size={16} aria-hidden="true" className={styles.chev} />
        </Link>
      ))}
    </nav>
  );
}
