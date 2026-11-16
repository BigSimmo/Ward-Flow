import type { Metadata } from "next";

import { DowntimePackScreen } from "@/components/ward-management/reports/downtime-pack-screen";

export const metadata: Metadata = {
  title: "Downtime pack — BedChart",
  description:
    "Synthetic, printable snapshot of beds, ED queue, pending moves and legal forms for the BedChart prototype.",
};

export default function WardDowntimePackPage() {
  return <DowntimePackScreen />;
}
