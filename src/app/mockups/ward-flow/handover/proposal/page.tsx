import type { Metadata } from "next";

import { HandoverProposal } from "@/components/ward-management/flow-proposal/handover-proposal";

export const metadata: Metadata = {
  title: "Handover redesign preview — Ward Flow",
  description: "Proposed shift handover screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 shift handover redesign proposal. The current screen is unchanged. */
export default function HandoverProposalPage() {
  return <HandoverProposal />;
}
