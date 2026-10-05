import type { Metadata } from "next";

import { CommandProposal } from "@/components/ward-management/coordinator/proposal/command-proposal";

export const metadata: Metadata = {
  title: "Command redesign preview — Ward Flow",
  description: "Proposed Command screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 Command redesign proposal. The live screen is unchanged. */
export default function CommandProposalPage() {
  return <CommandProposal />;
}
