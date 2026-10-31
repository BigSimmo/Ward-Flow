"use client";

import { StatisticsRedesign } from "./statistics-redesign";
import chipFade from "./statistics-chip-fade.module.css";

/** Network statistics, as the app's `/ward-flow/statistics` opens. */
export function StatisticsPage() {
  // Josh, 31 Oct 2026: the phone chip row fades at an edge with more chips past it
  // (`statistics-chip-fade.module.css`).
  return (
    <div className={chipFade.scope}>
      <StatisticsRedesign />
    </div>
  );
}
