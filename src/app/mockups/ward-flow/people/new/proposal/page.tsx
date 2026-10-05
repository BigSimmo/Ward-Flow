import type { Metadata } from "next";

import { AddPatientProposal } from "@/components/ward-management/people-proposal/add-patient-proposal";

export const metadata: Metadata = {
  title: "Add a patient redesign preview — Ward Flow",
  description: "Proposed Add a patient screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 search-and-patient redesign proposal. */
export default function AddPatientProposalPage() {
  return <AddPatientProposal />;
}
