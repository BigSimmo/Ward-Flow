"use client";

import { StatisticsCompareRedesign } from "./statistics-compare-redesign";
import chipFade from "@/components/ward-management/statistics/statistics-nav.module.css";

/** Ward and ED comparisons, as the app's `/ward-flow/statistics/compare` opens. */
export function StatisticsComparePage() {
  // Josh, 31 Oct 2026: the phone chip row fades at an edge with more chips past it
  // (`statistics-chip-fade.module.css`).
  return (
    <div className={chipFade.scope}>
      <StatisticsCompareRedesign />
    </div>
  );
}
