import type { ReactNode } from "react";
import { StatisticsNav } from "@/components/ward-management/statistics/statistics-nav";
import { StatisticsSampleFigures } from "@/components/ward-management/statistics/statistics-sample-figures";
import polish from "@/components/ward-management/statistics/statistics-polish.module.css";

export default function WardStatisticsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StatisticsNav />
      <div className={polish.root}>
        <StatisticsSampleFigures />
        {children}
      </div>
    </>
  );
}
