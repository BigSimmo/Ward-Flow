import type { Metadata } from "next";

import { StatisticsIndexRoute } from "@/components/ward-management/statistics/statistics-index-route";

export const metadata: Metadata = {
  title: "All emergency departments — Statistics — BedChart",
  description: "Synthetic statistics for every emergency department in the BedChart prototype.",
};

/**
 * The EDs index: everyone waiting in every emergency department, then each department in a table
 * that leads to its own statistics page. It has no params and supplies nothing.
 */
export default function WardStatisticsEdsPage() {
  return <StatisticsIndexRoute segment="eds" />;
}
