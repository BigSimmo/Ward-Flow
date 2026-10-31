"use client";

import { StatisticsListRedesign } from "./statistics-list-redesign";
import chipFade from "@/components/ward-management/statistics/statistics-nav.module.css";

/** Every ward in one table, as the app's `/ward-flow/statistics/wards` opens. */
export function StatisticsListPage() {
  // Josh, 31 Oct 2026: the phone chip row fades at an edge with more chips past it
  // (`statistics-chip-fade.module.css`).
  return (
    <div className={chipFade.scope}>
      <StatisticsListRedesign />
    </div>
  );
}
