import type { Metadata } from "next";

import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";

export const metadata: Metadata = {
  title: "Ward and ED comparisons — Ward Flow",
  description: "Synthetic ward and emergency department comparison section for the Ward Flow prototype.",
};

/**
 * The route that makes the comparisons section reachable. Its "Open a unit" links to the one unit
 * finder on the Statistics summary (D-91).
 *
 * ⚠️ **It must never pass `units` or `emergencyDepartments`.** The screen accepts both as optional
 * overrides so a test can render a network the seed cannot produce, and both fall back to live
 * state. A route that passed either would pin the comparisons to a fixture, and a ward added to the
 * prototype would then be missing from them.
 */
export default function WardStatisticsComparePage() {
  return <StatisticsCompareScreen />;
}
