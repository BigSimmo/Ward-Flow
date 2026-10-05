import type { Metadata } from "next";

import { PatientsProposal } from "@/components/ward-management/people-proposal/patients-proposal";

export const metadata: Metadata = {
  title: "Patients redesign preview — Ward Flow",
  description: "Proposed Patients screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 search-and-patient redesign proposal. */
export default function PatientsProposalPage() {
  return <PatientsProposal />;
}
