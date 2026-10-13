import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./ward-not-found.module.css";

/**
 * ONE NOT-FOUND PATTERN (shell-12, 13 Oct 2026). Person, movement, ward, board, ED and community
 * pages each had their own wording and exits, some quoting internal ids. Every one now reads the
 * same way inside the shell (the header and dock stay, from the layout): a title, one plain
 * sentence that never echoes an internal id, one link to the right list, and the patient search.
 */
export function WardNotFoundBody({
  title,
  testId,
  children,
  list,
  extra,
  search = <Link href="/mockups/ward-flow/search">Search patients</Link>,
}: {
  title: string;
  testId?: string;
  /** The one plain sentence. */
  children: ReactNode;
  /** The list this kind of record lives in. */
  list: { href: string; label: string };
  /** An extra, more specific way on, ahead of the list link. */
  extra?: ReactNode;
  /** The patient search link; a caller may swap in one that carries a UMRN in memory. */
  search?: ReactNode;
}) {
  return (
    <div className={styles.body}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.sentence} data-testid={testId}>
        {children}
      </p>
      <p className={styles.links}>
        {extra}
        <Link href={list.href}>{list.label}</Link>
        {search}
      </p>
    </div>
  );
}
