import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import type { WardNavCount } from "@/components/ward-management/ward-nav-counts";
import styles from "./ward-phone-menu.module.css";
import type { RailEntry } from "./ward-rail-entries";

/*
 * Small pieces shared by the phone menu and its search results (`ward-phone-menu-results.tsx`),
 * kept here so the results, which load after the page, need not import the menu itself.
 */

export const Chevron = () => <ChevronRight aria-hidden="true" className={styles.chevron} strokeWidth={1.75} />;

export function Section({ label, rich, children }: { label: string; rich?: boolean; children: ReactNode }) {
  return (
    <section aria-label={label} className={styles.section}>
      <p className={styles.heading}>{label}</p>
      <ul className={rich ? `${styles.list} ${styles.rich}` : styles.list}>{children}</ul>
    </section>
  );
}

export type PageRowRender = (entry: RailEntry, count?: WardNavCount, withMeta?: boolean) => ReactNode;

/** Shown while the menu search is still working out its results, or still loading. */
export function MenuSearching() {
  return (
    <Section label="Searching">
      <li className={styles.empty}>Searching…</li>
    </Section>
  );
}
