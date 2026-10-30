"use client";

import { useEffect, type ReactNode } from "react";

import styles from "./pop-officer-job.module.css";

/**
 * The transport officer's job panel, drawn over the Transport desk. The panel is the desk's own:
 * it opens when a job row is chosen, so this presses the first job's row once the desk has drawn,
 * exactly as a person would. Everything inside it (steps, forms pack, copy, close) is the real wiring.
 * The one design change is scoped CSS: the four leg steps sit two by two on wider screens.
 */
export function PopOfficerJob({ page }: { page: ReactNode }) {
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const open = document.querySelector('[data-testid="ward-officer-detail"]');
      const first = document.querySelector<HTMLButtonElement>('[data-testid^="ward-officer-select-"]');
      if (open || tries > 40) window.clearInterval(timer);
      else if (first) {
        first.click();
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, []);
  return <div className={styles.scope}>{page}</div>;
}
