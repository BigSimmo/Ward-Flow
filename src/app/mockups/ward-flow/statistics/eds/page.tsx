import type { Metadata } from "next";

import { StatisticsEdsIndexScreen } from "@/components/ward-management/statistics/statistics-eds-index";

export const metadata: Metadata = {
  title: "All emergency departments — Statistics — Ward Flow",
  description: "Synthetic statistics for every emergency department in the Ward Flow prototype.",
};

/**
 * The EDs index: everyone waiting in every emergency department, then each department in a table
 * that leads to its own statistics page. It has no params and supplies nothing.
 */
export default function WardStatisticsEdsPage() {
  return <StatisticsEdsIndexScreen />;
}
