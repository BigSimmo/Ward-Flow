import type { Metadata } from "next";

import { PatientProposal } from "@/components/ward-management/people-proposal/patient-proposal";

export const metadata: Metadata = {
  title: "Patient redesign preview — Ward Flow",
  description: "Proposed one-patient screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 search-and-patient redesign proposal. `?id=` takes a
 *  patient (PT-) or journey (WF-) id, the same ids the current patient route accepts. */
export default async function PatientProposalPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <PatientProposal id={id ?? "PT-001"} />;
}
