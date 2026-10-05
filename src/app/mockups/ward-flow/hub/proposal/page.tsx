import type { Metadata } from "next";

import { HubProposal } from "@/components/ward-management/people-proposal/hub-proposal";

export const metadata: Metadata = {
  title: "Search hub redesign preview — Ward Flow",
  description: "Proposed Search hub screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 search-and-patient redesign proposal. */
export default function HubProposalPage() {
  return <HubProposal />;
}
