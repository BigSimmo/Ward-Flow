import type { Metadata } from "next";

import { AlertsProposal } from "@/components/ward-management/flow-proposals/alerts-proposal";

export const metadata: Metadata = {
  title: "Alerts redesign preview — Ward Flow",
  description: "Proposed Alerts screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 Alerts redesign proposal. Reads live shared state only. */
export default function AlertsProposalPage() {
  return <AlertsProposal />;
}
