"use client";

import { StatisticsWeeklyRedesign } from "./statistics-weekly-redesign";
import chipFade from "@/components/ward-redesign/statistics/statistics-chip-fade.module.css";

/** The weekly operations report, as the app's `/ward-flow/statistics/weekly` opens. */
export function StatisticsWeeklyPage() {
  // Josh, 31 Oct 2026: the phone chip row fades at an edge with more chips past it
  // (`statistics-chip-fade.module.css`).
  return (
    <div className={chipFade.scope}>
      <StatisticsWeeklyRedesign />
    </div>
  );
}
