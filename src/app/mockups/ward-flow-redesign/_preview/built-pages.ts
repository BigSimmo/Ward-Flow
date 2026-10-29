/** Preview only: the mock-up slugs rebuilt in React so far. `screen-components.tsx` must draw each one. */
export const MOCKUP_PAGE_SLUGS = ["capacity", "home"] as const;

export type BuiltPageSlug = (typeof MOCKUP_PAGE_SLUGS)[number];
