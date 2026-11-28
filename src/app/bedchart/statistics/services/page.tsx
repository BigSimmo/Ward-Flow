import type { Metadata } from "next";

import { StatisticsIndexRoute } from "@/components/ward-management/statistics/statistics-index-route";

export const metadata: Metadata = {
  title: "Health services — Statistics — BedChart",
  description: "Synthetic statistics for every health service in the BedChart prototype.",
};

/**
 * The Services index: every health service on one page, each card the way into its own statistics
 * page. It has no params and supplies nothing; the screen reads live state.
 */
export default function WardStatisticsServicesPage() {
  return <StatisticsIndexRoute segment="services" />;
}
