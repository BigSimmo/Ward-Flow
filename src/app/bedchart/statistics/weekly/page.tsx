import type { Metadata } from "next";

import { WeeklyReportScreen } from "@/components/ward-management/reports/weekly-report-screen";

export const metadata: Metadata = {
  title: "Weekly — Statistics — BedChart",
  description: "Synthetic, printable weekly operations report for the BedChart prototype.",
};

export default function WardWeeklyReportPage() {
  return <WeeklyReportScreen />;
}
