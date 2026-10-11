"use client";

import Link from "next/link";

import { MOCKUP_OPTIONS, type MockupOption } from "./preview-option";
import styles from "./preview-bar.module.css";

/**
 * Preview-only control: one compact line naming the mockup topic and switching between options
 * A, B and C (and, where a topic spans pages, the page). It never appears on a live route.
 */
export function MockupPreviewBar<Option extends string = MockupOption>({
  topic,
  option,
  hrefFor,
  pages,
  options = MOCKUP_OPTIONS as unknown as readonly Option[],
}: {
  topic: string;
  option: Option;
  hrefFor: (option: Option, page?: string) => string;
  pages?: { id: string; label: string; current: boolean }[];
  options?: readonly Option[];
}) {
  const currentPage = pages?.find((page) => page.current)?.id;
  return (
    <nav className={styles.bar} aria-label="Mockup options" data-testid="mockup-preview-bar">
      <span className={styles.label}>
        Mockup · <b>{topic}</b>
      </span>
      <span className={styles.group}>
        {options.map((candidate) => (
          <Link
            key={candidate}
            href={hrefFor(candidate, currentPage)}
            className={styles.pill}
            aria-current={candidate === option ? "page" : undefined}
          >
            {candidate}
          </Link>
        ))}
      </span>
      {pages ? (
        <span className={styles.group}>
          {pages.map((page) => (
            <Link
              key={page.id}
              href={hrefFor(option, page.id)}
              className={styles.pill}
              aria-current={page.current ? "page" : undefined}
            >
              {page.label}
            </Link>
          ))}
        </span>
      ) : null}
      <span className={styles.note}>Not the live page</span>
    </nav>
  );
}
