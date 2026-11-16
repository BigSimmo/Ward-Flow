import type { Metadata } from "next";

import { AddPatientForm } from "@/components/ward-management/patients/add-patient";

export const metadata: Metadata = {
  title: "Add patient — BedChart",
  description: "Synthetic front-door add-patient form for the BedChart prototype.",
};

export default function AddPatientPage() {
  return <AddPatientForm />;
}
