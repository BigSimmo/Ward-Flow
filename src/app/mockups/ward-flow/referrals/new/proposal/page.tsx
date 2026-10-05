import type { Metadata } from "next";

import { ReferralIntakeProposal } from "@/components/ward-management/flow-proposal/referral-intake-proposal";

export const metadata: Metadata = {
  title: "Make a referral redesign preview — Ward Flow",
  description: "Proposed make a referral screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 make a referral redesign proposal. The current screen is unchanged. */
export default function ReferralIntakeProposalPage() {
  return <ReferralIntakeProposal />;
}
