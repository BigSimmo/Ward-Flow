import type { Metadata } from "next";

import { WeeklyReportScreen } from "@/components/ward-management/reports/weekly-report-screen";

export const metadata: Metadata = {
  title: "Weekly operations report — Ward Flow",
  description: "Synthetic, printable weekly operations report for the Ward Flow prototype.",
};

export default function WardWeeklyReportPage() {
  return <WeeklyReportScreen />;
}
