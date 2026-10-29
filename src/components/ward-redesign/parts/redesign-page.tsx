import type { ReactNode } from "react";

import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./redesign-page.module.css";

/**
 * One redesigned page: the Ward canvas, the page's own `<main>` (the skip link's target) and the
 * synthetic-data disclosure every ward route must carry (`tests/ward-prototype-disclosure.test.ts`).
 */
export function RedesignPage({
  testId,
  hero,
  footNote,
  children,
}: {
  testId: string;
  /** The page's hero, drawn first so it takes the band under the header. */
  hero: ReactNode;
  /** The footer's line, when the page has more to say than the standard disclosure. */
  footNote?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.screen} data-testid={testId} data-ward-design="redesign-2026-10">
      <main id="main-content" className={styles.main}>
        {hero}
        {children}
        <WardPrototypeFooter note={footNote} />
      </main>
    </div>
  );
}
