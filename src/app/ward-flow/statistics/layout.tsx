import type { ReactNode } from "react";
import { StatisticsSampleFigures } from "@/components/ward-management/statistics/statistics-sample-figures";
import polish from "@/components/ward-management/statistics/statistics-polish.module.css";

/**
 * Each statistics page carries the section track and the Samples switch in its own hero band.
 * Invented sample charts, when switched on, follow the page's real figures.
 */
export default function WardStatisticsLayout({ children }: { children: ReactNode }) {
  return (
    <div className={polish.root}>
      {children}
      <StatisticsSampleFigures />
    </div>
  );
}
