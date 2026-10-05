import type { Metadata } from "next";

import { GovernanceProposal } from "@/components/ward-management/oversight-proposal/governance-proposal";

export const metadata: Metadata = {
  title: "Governance redesign preview — Ward Flow",
  description: "Proposed governance screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 governance redesign proposal. The current screen is unchanged. */
export default function GovernanceProposalPage() {
  return <GovernanceProposal />;
}
