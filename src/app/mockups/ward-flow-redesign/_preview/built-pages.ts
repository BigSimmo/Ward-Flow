/** Preview only: the mock-up slugs rebuilt in React so far. `screen-components.tsx` must draw each one. */
export const MOCKUP_PAGE_SLUGS = [
  "capacity",
  "home",
  "movements",
  "waiting",
  "eds",
  "referrals",
  "new-referral",
  "handover",
  "ward",
  "stays",
  "ed-board",
  "transport",
  "patients",
  "discharges",
  "wards",
  "statistics",
  "alerts",
  "legal-forms",
  "out-of-area",
  "on-call",
] as const;

export type BuiltPageSlug = (typeof MOCKUP_PAGE_SLUGS)[number];
