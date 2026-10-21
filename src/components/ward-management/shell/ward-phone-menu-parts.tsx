import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import type { WardNavCount } from "@/components/ward-management/ward-nav-counts";
import styles from "./ward-phone-menu.module.css";
import type { RailEntry } from "./ward-rail-entries";
import type { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";

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

type NavCountMap = ReturnType<typeof useWardNavCounts>["counts"];

export function countIn(counts: NavCountMap, id: string): WardNavCount | undefined {
  return counts[id as keyof NavCountMap];
}

export function CountChip({ value, className }: { value: number | undefined; className: string }) {
  if (!value) return null;
  return (
    <span className={className} aria-hidden="true">
      {value > 99 ? "99+" : value}
    </span>
  );
}
