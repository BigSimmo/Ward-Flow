/**
 * Figure dictionary rows: STATISTICS-ONLY ED FIGURES (figures spec 3.2 and 6, D-220). Kept apart
 * from `ed-figures.ts` so a route that shows ED figures without Statistics does not load the
 * Statistics derivations.
 */
import { defineFigure } from "@/components/ward-management/figures/figure-row";
import { median } from "@/components/ward-management/statistics/executive-statistics-derivations";

export const MEDIAN_ED_WAIT_FIGURE = defineFigure({
  id: "median-ed-wait",
  name: "Median wait in ED",
  rule: "The middle time in the department of the people waiting in ED now; with an even count, the mean of the middle two.",
  window: "now",
  windowId: "ed-wait",
  population: "Waiting in ED",
  scope: "desk",
  status: "built",
  compute: median,
  home: "`median` (`statistics/executive-statistics-derivations.ts`); the inline copy beside it goes in phase 2",
  how: ["Each person's time in the department, from the journey's start.", "Nobody waiting: no median."],
  basis: "M121",
});
