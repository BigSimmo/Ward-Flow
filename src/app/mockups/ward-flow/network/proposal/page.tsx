import type { Metadata } from "next";

import { BedFlowProposalPreview } from "@/components/ward-management/bed-flow-proposal/bed-flow-proposal-preview";

export const metadata: Metadata = {
  title: "Network polish preview — Ward Flow",
  description: "The current Network screen, structure unchanged, polished for review on synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 Network polish. Reads live shared state only. */
export default function NetworkProposalPage() {
  return <BedFlowProposalPreview screen="network" />;
}
