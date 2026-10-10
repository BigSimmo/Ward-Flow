import type { Metadata } from "next";

import { StatisticsTeamsIndexScreen } from "@/components/ward-management/statistics/statistics-teams-index";

export const metadata: Metadata = {
  title: "Community teams — Statistics — Ward Flow",
  description: "Synthetic statistics for every community team in the Ward Flow prototype.",
};

/**
 * The Teams index: every community team, grouped by health service, each the way into its own
 * statistics page. It has no params and supplies nothing.
 */
export default function WardStatisticsTeamsPage() {
  return <StatisticsTeamsIndexScreen />;
}
