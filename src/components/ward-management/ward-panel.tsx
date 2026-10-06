// src/components/ward-management/ward-panel.tsx
import type { ReactNode } from "react";

import styles from "./ward-panel.module.css";

/**
 * The Board panel: a bordered surface with its own header.
 *
 * The heading labels the section, so a screen-reader user can list a screen's panels and jump
 * between them. `headingLevel` exists because a panel inside a band sits one level deeper and a
 * skipped level is a real navigation defect, not a style preference.
 *
 * `testId` is OPTIONAL and exists only to preserve a testid contract a screen already had before
 * it adopted this panel. It is not the way to find a panel: `title` is already the section's
 * accessible name, so `getByRole("region", { name })` reaches every panel without one. A new
 * panel should not grow a testid just because the prop is here.
 */
export function WardPanel({
  title,
  accessibleName,
  count,
  blurb,
  blurbInHeader = false,
  headingLevel = 2,
  testId,
  dataTabSection,
  children,
}: {
  title: string;
  /** Region name when the visible heading is shorter than the name tests and screen readers use. */
  accessibleName?: string;
  count?: string;
  blurb?: string;
  blurbInHeader?: boolean;
  headingLevel?: 2 | 3;
  testId?: string;
  dataTabSection?: string;
  children: ReactNode;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section
      className={styles.panel}
      aria-label={accessibleName ?? title}
      data-testid={testId}
      data-ward-primitive="panel"
      data-tab-section={dataTabSection}
    >
      <header
        className={`${styles.panelHeader}${blurbInHeader ? ` ${styles.inlineHeader}` : ""}`}
        data-ward-primitive="panel-header"
      >
        <Heading className={styles.panelTitle}>{title}</Heading>
        {blurb && blurbInHeader ? <p className={styles.headerBlurb}>{blurb}</p> : null}
        {count ? (
          <span className={styles.panelCount} data-ward-panel-count>
            {count}
          </span>
        ) : null}
      </header>
      {blurb && !blurbInHeader ? <p className={styles.panelBlurb}>{blurb}</p> : null}
      {children}
    </section>
  );
}
