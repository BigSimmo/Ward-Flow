import type { Metadata } from "next";

import { BedFlowProposalPreview } from "@/components/ward-management/bed-flow-proposal/bed-flow-proposal-preview";

export const metadata: Metadata = {
  title: "Capacity redesign preview — Ward Flow",
  description: "Proposed Capacity screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 Capacity redesign proposal. Reads live shared state only. */
export default function CapacityProposalPage() {
  return <BedFlowProposalPreview screen="capacity" />;
}
