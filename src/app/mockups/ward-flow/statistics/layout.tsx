import type { ReactNode } from "react";
import { StatisticsNav } from "@/components/ward-management/statistics/statistics-nav";

export default function WardStatisticsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StatisticsNav />
      {children}
    </>
  );
}
