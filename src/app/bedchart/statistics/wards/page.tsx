import type { Metadata } from "next";

import { StatisticsIndexRoute } from "@/components/ward-management/statistics/statistics-index-route";

export const metadata: Metadata = {
  title: "All wards — Statistics — BedChart",
  description: "Synthetic statistics for every inpatient ward in the BedChart prototype.",
};

/**
 * The Wards index: every ward in one sortable table, each row the way into its own statistics page.
 * It has no params and supplies nothing; the screen reads live state, so a ward added to the
 * prototype appears here without a change to this file.
 */
export default function WardStatisticsWardsPage() {
  return <StatisticsIndexRoute segment="wards" />;
}
