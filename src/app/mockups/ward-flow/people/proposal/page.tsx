import type { Metadata } from "next";

import { PatientPolish } from "@/components/ward-management/people-polish/patient-polish";

export const metadata: Metadata = {
  title: "Patient polish preview — Ward Flow",
  description: "Polished patient screen for review: the current structure, with finish and wording improved.",
};

/** Preview route for the 5 October 2026 polish of the current patient screen (structure unchanged).
 *  `?id=` takes a patient (PT-) or journey (WF-) id, the same ids the current patient route accepts. */
export default async function PatientProposalPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id = "PT-001" } = await searchParams;
  return (
    <PatientPolish
      patientId={id.startsWith("PT-") ? id : undefined}
      movementId={id.startsWith("WF-") ? id : undefined}
    />
  );
}
