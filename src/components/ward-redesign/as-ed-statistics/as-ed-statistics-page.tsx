"use client";

import { AsEdStatisticsEdScreen } from "./as-ed-statistics-ed-screen";

/**
 * As ED clinician: Statistics as this role sees it. D-80 holds an ED desk to its own department's
 * statistics page (`OWN_STATISTICS_SECTION` in `ward-role-access.ts`), so the role view draws that
 * page for Peel ED, as the app's `/ward-flow/statistics/ed/peel-ed` does, never the network hub. The
 * page is a fork of `statistics-ed-screen.tsx` that leads with the counts on that desk.
 */
export function AsEdStatisticsPage() {
  return <AsEdStatisticsEdScreen edId="peel-ed" />;
}
