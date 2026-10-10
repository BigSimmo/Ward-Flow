import type { Metadata } from "next";

import { StatisticsServicesIndexScreen } from "@/components/ward-management/statistics/statistics-services-index";

export const metadata: Metadata = {
  title: "Health services — Statistics — Ward Flow",
  description: "Synthetic statistics for every health service in the Ward Flow prototype.",
};

/**
 * The Services index: every health service on one page, each card the way into its own statistics
 * page. It has no params and supplies nothing; the screen reads live state.
 */
export default function WardStatisticsServicesPage() {
  return <StatisticsServicesIndexScreen />;
}
