"use client";

import { StatisticsPage } from "@/components/ward-redesign/as-ward-statistics/statistics-page";

/**
 * As nurse in charge: the Statistics mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`). The page is a fork of the coordinator's Statistics entry with
 * one commented `access.role === "ward"` branch: the desk opens its own ward's page as counts (D-80),
 * the same page the real menu's Statistics sends it to.
 */
export function AsWardStatisticsPage() {
  return <StatisticsPage />;
}
