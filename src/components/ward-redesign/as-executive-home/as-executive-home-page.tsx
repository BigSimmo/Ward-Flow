"use client";

import { StatisticsPage } from "@/components/ward-redesign/statistics/statistics-page";

/**
 * As executive: the Statistics mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsExecutiveHomePage() {
  return <StatisticsPage />;
}
