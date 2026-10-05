import type { Metadata } from "next";

import { OnCallProposal } from "@/components/ward-management/flow-proposals/on-call-proposal";

export const metadata: Metadata = {
  title: "On-call redesign preview — Ward Flow",
  description: "Proposed On-call screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 On-call redesign proposal. Reads live shared state only. */
export default function OnCallProposalPage() {
  return <OnCallProposal />;
}
