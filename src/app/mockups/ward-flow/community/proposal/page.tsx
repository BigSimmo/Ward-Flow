import type { Metadata } from "next";

import { CommunityHubProposal } from "@/components/ward-management/community/proposal/community-hub-proposal";

export const metadata: Metadata = {
  title: "Community teams redesign preview — Ward Flow",
  description: "Proposed community hub for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 community redesign proposal. The current hub is unchanged. */
export default function CommunityHubProposalPage() {
  return <CommunityHubProposal />;
}
