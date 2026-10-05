import type { Metadata } from "next";

import { DischargesProposal } from "@/components/ward-management/flow-proposal/discharges-proposal";

export const metadata: Metadata = {
  title: "Discharges redesign preview — Ward Flow",
  description: "Proposed discharges screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 discharges redesign proposal. The current screen is unchanged. */
export default function DischargesProposalPage() {
  return <DischargesProposal />;
}
