"use client";

import { ShowMoreRow, foldHidden, foldLimit } from "@/components/wf";

import styles from "./ward-index.module.css";

/**
 * All wards as a site bed manager (D-80): its own site's wards first and in full, then every other
 * site's wards as bed counts only, the first few with Show all. `WardIndex` branches on the desk.
 */

/** Site bed manager: other-site cards shown before "Show all". */
export const OTHER_SITE_CARDS = 6;

/**
 * Site bed manager: how many other-site cards show while folded. The list folds only when two or more
 * cards would be hidden (Josh, answer 21), so seven sites show all seven and no Show all row.
 */
export function otherSitesFolded(total: number): number {
  return foldLimit(total, OTHER_SITE_CARDS);
}

/** Site bed manager: the heading over the desk's own site and over the other sites. */
export function SiteHead({ title, meta }: { title: string; meta: string }) {
  return (
    <h2 className={styles.siteHead}>
      <span className={styles.siteTitle}>{title}</span>
      <span className={styles.siteMeta}>{meta}</span>
    </h2>
  );
}

/** Site bed manager: Show all or fewer of the other sites' wards. */
export function OtherSitesMore({
  shown,
  total,
  open,
  onToggle,
}: {
  shown: number;
  total: number;
  open: boolean;
  onToggle: () => void;
}) {
  if (foldHidden(total, OTHER_SITE_CARDS) === 0) return null;
  if (!open && shown >= total) return null;
  return (
    <ShowMoreRow onClick={onToggle} expanded={open}>
      {open ? "Show fewer other sites" : `Show all ${total} wards at other sites`}
    </ShowMoreRow>
  );
}
