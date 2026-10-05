import type { Metadata } from "next";

import { ReferralBoardProposal } from "@/components/ward-management/flow-proposal/referral-board-proposal";

export const metadata: Metadata = {
  title: "Referral board redesign preview — Ward Flow",
  description: "Proposed referral board screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 referral board redesign proposal. The current screen is unchanged. */
export default function ReferralBoardProposalPage() {
  return <ReferralBoardProposal />;
}
