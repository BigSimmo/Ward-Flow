import type { Metadata } from "next";

import { StatisticsIndexRoute } from "@/components/ward-management/statistics/statistics-index-route";

export const metadata: Metadata = {
  title: "Community teams — Statistics — BedChart",
  description: "Synthetic statistics for every community team in the BedChart prototype.",
};

/**
 * The Teams index: every community team, grouped by health service, each the way into its own
 * statistics page. It has no params and supplies nothing.
 */
export default function WardStatisticsTeamsPage() {
  return <StatisticsIndexRoute segment="teams" />;
}
