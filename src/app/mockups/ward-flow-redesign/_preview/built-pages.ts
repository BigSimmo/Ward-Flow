/** Preview only: the mock-up slugs rebuilt in React so far. `screen-components.tsx` must draw each one. */
export const MOCKUP_PAGE_SLUGS = [
  "capacity",
  "home",
  "waiting",
  "new-referral",
  "ward",
  "ed-board",
  "legal-forms",
  "patient",
  "add-patient",
  "settings",
  "statistics-compare",
  "statistics-list",
  "statistics-weekly",
  "as-ward-settings",
  "as-ed-home",
  "as-executive-settings",
  "as-admin-home",
] as const;

export type BuiltPageSlug = (typeof MOCKUP_PAGE_SLUGS)[number];
