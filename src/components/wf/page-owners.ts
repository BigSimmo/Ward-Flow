/**
 * THE PAGES THAT OWN FIGURES (Josh, 3 Nov 2026, kit rule a). Each figure has one home page, named by
 * the job that page does. Any other page may repeat the figure at most twice, as the same live number
 * linking here (`FigureLink`), never reworded. `job` is the page's question, kept beside the route so
 * a new caller can check it has picked the right owner.
 */
export type PageOwner = {
  /** The route under `src/app/ward-flow` that owns the figure. */
  route: string;
  /** The page's name as the menu shows it, used in "open <name>". */
  name: string;
  /** The one job the page does. */
  job: string;
};

export const PAGE_OWNERS = {
  home: { route: "/ward-flow", name: "Home", job: "What needs me now" },
  capacity: { route: "/ward-flow/capacity", name: "Capacity", job: "Do we have the right beds today and tomorrow" },
  wards: { route: "/ward-flow/wards", name: "All wards", job: "What state one ward is in" },
  waiting: { route: "/ward-flow/waiting", name: "Waiting", job: "Who in ED has waited longest and why" },
  movements: { route: "/ward-flow/movements", name: "Movements", job: "Get each accepted patient to arrival" },
  referrals: { route: "/ward-flow/referrals", name: "Referrals", job: "Decide each referral" },
  discharges: { route: "/ward-flow/discharges", name: "Discharges", job: "Clear held-up releases" },
  // `/ward-flow/transport` only redirects here (shell-19), so the owner is the officer's page itself.
  transport: { route: "/ward-flow/transport/officer", name: "Transport", job: "Get a booking for every pulled bed" },
} as const satisfies Record<string, PageOwner>;

export type PageOwnerKey = keyof typeof PAGE_OWNERS;
