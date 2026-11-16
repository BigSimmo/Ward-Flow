import type { Metadata } from "next";

import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";

export const metadata: Metadata = {
  title: "Transport — BedChart",
  description: "Synthetic transport officer phone view for the BedChart prototype.",
};

export default function TransportOfficerPage() {
  return <OfficerScreen />;
}
