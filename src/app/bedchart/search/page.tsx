import type { Metadata } from "next";

import { PatientSearchPage } from "@/components/ward-management/search/patient-search";

export const metadata: Metadata = {
  title: "Patients — BedChart",
  description: "Synthetic prototype: find an open BedChart movement by id, department, destination, stage or owner.",
};

export default function WardPatientSearchPage() {
  return <PatientSearchPage />;
}
