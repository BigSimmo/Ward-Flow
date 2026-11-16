import type { FigureOwner } from "@/components/wf";

/**
 * THE PAGES THAT OWN FIGURES (Josh, 3 Nov 2026, kit rule a). Each figure has one home page, named by
 * the job that page does. Any other page may repeat the figure at most twice, as the same live number
 * linking here (the kit's `FigureLink`, passed `PAGE_OWNERS.<page>`), never reworded. `job` is the page's question, kept beside the route so
 * a new caller can check it has picked the right owner.
 */
export type PageOwner = FigureOwner & {
  /** The one job the page does. */
  job: string;
};

export const PAGE_OWNERS = {
  home: { route: "/bedchart", name: "Home", job: "What needs me now" },
  capacity: { route: "/bedchart/capacity", name: "Capacity", job: "Do we have the right beds today and tomorrow" },
  wards: { route: "/bedchart/wards", name: "All wards", job: "What state one ward is in" },
  waiting: { route: "/bedchart/waiting", name: "Waiting", job: "Who in ED has waited longest and why" },
  movements: { route: "/bedchart/movements", name: "Movements", job: "Get each accepted patient to arrival" },
  referrals: { route: "/bedchart/referrals", name: "Referrals", job: "Decide each referral" },
  discharges: { route: "/bedchart/discharges", name: "Discharges", job: "Clear held-up discharges" },
  // `/bedchart/transport` only redirects here (shell-19), so the owner is the officer's page itself.
  transport: { route: "/bedchart/transport/officer", name: "Transport", job: "Get a booking for every pulled bed" },
} as const satisfies Record<string, PageOwner>;
