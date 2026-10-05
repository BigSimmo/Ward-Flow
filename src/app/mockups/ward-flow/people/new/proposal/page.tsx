import type { Metadata } from "next";

import { AddPatientPolish } from "@/components/ward-management/people-polish/add-patient-polish";

export const metadata: Metadata = {
  title: "Add a patient polish preview — Ward Flow",
  description: "Polished Add a patient form for review: the current structure, with finish and wording improved.",
};

/** Preview route for the 5 October 2026 polish of the current Add a patient form (structure unchanged). */
export default function AddPatientProposalPage() {
  return <AddPatientPolish />;
}
