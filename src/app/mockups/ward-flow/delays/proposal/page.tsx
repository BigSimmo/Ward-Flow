import type { Metadata } from "next";

import { DelaysProposal } from "@/components/ward-management/flow-proposals/delays-proposal";

export const metadata: Metadata = {
  title: "Delays redesign preview — Ward Flow",
  description: "Proposed Delays screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 Delays redesign proposal. Reads live shared state only. */
export default function DelaysProposalPage() {
  return <DelaysProposal />;
}
