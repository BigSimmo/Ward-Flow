import styles from "./folder-tabs.module.css";

// Kept apart from `folder-tabs.tsx` so a page that only borrows these class names (the Statistics
// share menu, on every Statistics page's first load) does not also load the folder tab row itself
// (phone script budget, PR #1742).

/**
 * Class names a page puts on its own parts of a folder tab row: `switch` on the primary tab control
 * (PillTabs or Segmented), `hero` on the `Hero` just above the row (it makes room for the folder and
 * steps the band's lip aside on phone and tablet), `rule` on an optional divider before filters, and
 * `more` on a More button.
 */
export const folderTabClasses = {
  switch: styles.switch,
  hero: styles.hero,
  rule: styles.rule,
  filters: styles.filters,
  more: styles.more,
  moreOutlined: styles.moreOutlined,
} as const;
