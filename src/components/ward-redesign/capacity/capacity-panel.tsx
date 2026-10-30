// Fork of src/components/ward-management/ward-panel.tsx (Capacity redesign): the same panel, with
// its title in the card-title style every other card on this page uses (sentence case, 600, ink-1)
// instead of the Board panel's small capitals (Josh, 30 Oct 2026). Only the header changes.
import type { ReactNode } from "react";

import wardPanel from "@/components/ward-management/ward-panel.module.css";
import styles from "./capacity-redesign.module.css";

export function CapacityPanel({
  title,
  count,
  testId,
  headerAction,
  children,
}: {
  title: string;
  count?: string;
  testId?: string;
  /** Optional control rendered in the header corner, after the count. */
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  const countNode = count ? (
    <span className={wardPanel.panelCount} data-ward-panel-count>
      {count}
    </span>
  ) : null;
  return (
    <section className={wardPanel.panel} aria-label={title} data-testid={testId} data-ward-primitive="panel">
      <header className={styles.panelHead} data-ward-primitive="panel-header">
        <h2 className={styles.panelTitle}>{title}</h2>
        {headerAction ? (
          <div className={wardPanel.panelHeaderEnd}>
            {countNode}
            {headerAction}
          </div>
        ) : (
          countNode
        )}
      </header>
      {children}
    </section>
  );
}
