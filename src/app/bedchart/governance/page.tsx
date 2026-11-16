import type { Metadata } from "next";

import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";

export const metadata: Metadata = {
  title: "Governance — BedChart",
  description: "Synthetic audit review, override register and data-boundary view for BedChart.",
};

export default function WardGovernancePage() {
  return <WardModeWorkspace mode="governance" />;
}
