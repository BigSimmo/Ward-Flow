"use client";

import { useExecutiveStatisticsControl } from "@/components/ward-management/statistics/executive-statistics-context";
import { ExecutiveCapacityScreen } from "./capacity-executive-screen";
import { CapacityScreen } from "./capacity-screen";

/** WF-06: a signed-in executive holds only the aggregate report, so Capacity is drawn from it. */
export function CapacityRoute() {
  const control = useExecutiveStatisticsControl();
  return control.executive ? <ExecutiveCapacityScreen /> : <CapacityScreen />;
}
