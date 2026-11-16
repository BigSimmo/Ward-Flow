import type { Metadata } from "next";

import { HandoverPage } from "@/components/ward-management/handover/handover-page";

export const metadata: Metadata = {
  title: "Handover — BedChart",
  description: "Synthetic, point-in-time, printable shift handover for the BedChart prototype.",
};

export default function WardHandoverPage() {
  return <HandoverPage />;
}
