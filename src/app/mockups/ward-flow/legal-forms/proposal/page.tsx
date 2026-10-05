import type { Metadata } from "next";

import { LegalFormsProposal } from "@/components/ward-management/oversight-proposal/legal-forms-proposal";

export const metadata: Metadata = {
  title: "Legal forms redesign preview — Ward Flow",
  description: "Proposed legal forms screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 legal forms redesign proposal. The current screen is unchanged. */
export default function LegalFormsProposalPage() {
  return <LegalFormsProposal />;
}
