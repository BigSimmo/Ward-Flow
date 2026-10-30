"use client";

// Forked from src/components/ward-redesign/statistics/statistics-page.tsx (role view: nurse in charge).

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { StatisticsRedesign } from "@/components/ward-redesign/statistics/statistics-redesign";
import { StatisticsUnitRedesign } from "@/components/ward-redesign/as-ward-statistics/statistics-unit-redesign";

/** Network statistics, as the app's `/ward-flow/statistics` opens. */
export function StatisticsPage() {
  const access = useEffectiveWardAccess();
  // Role view (nurse in charge), D-80: a ward desk's Statistics is its own ward's page alone, as counts
  // with no names (`ownStatisticsHrefFor` sends the menu there). It never opens the network page.
  if (access.role === "ward" && access.scope.kind === "ward")
    return <StatisticsUnitRedesign unitId={access.scope.unitIds[0]!} />;
  return <StatisticsRedesign />;
}
