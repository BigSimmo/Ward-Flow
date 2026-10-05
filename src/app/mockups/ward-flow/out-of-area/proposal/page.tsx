import type { Metadata } from "next";

import { OutOfAreaProposal } from "@/components/ward-management/oversight-proposal/out-of-area-proposal";

export const metadata: Metadata = {
  title: "Out of area redesign preview — Ward Flow",
  description: "Proposed out-of-area screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 out-of-area redesign proposal. The current screen is unchanged. */
export default function OutOfAreaProposalPage() {
  return <OutOfAreaProposal />;
}
