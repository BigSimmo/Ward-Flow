"use client";

import { StatisticsPage } from "@/components/ward-redesign/statistics/statistics-page";

/**
 * As nurse in charge: the Statistics mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsWardStatisticsPage() {
  return <StatisticsPage />;
}
