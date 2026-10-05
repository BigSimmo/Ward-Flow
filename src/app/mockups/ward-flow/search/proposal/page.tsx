import type { Metadata } from "next";

import { PatientsPolish } from "@/components/ward-management/people-polish/patients-polish";

export const metadata: Metadata = {
  title: "Patients polish preview — Ward Flow",
  description: "Polished Patients screen for review: the current structure, with finish and wording improved.",
};

/** Preview route for the 5 October 2026 polish of the current Patients screen (structure unchanged). */
export default function PatientsProposalPage() {
  return <PatientsPolish />;
}
