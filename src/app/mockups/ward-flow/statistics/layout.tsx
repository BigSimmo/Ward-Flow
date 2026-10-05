import type { ReactNode } from "react";
import { StatisticsNav } from "@/components/ward-management/statistics/statistics-nav";
import polish from "@/components/ward-management/statistics/statistics-polish.module.css";

export default function WardStatisticsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StatisticsNav />
      <div className={polish.root}>{children}</div>
    </>
  );
}
