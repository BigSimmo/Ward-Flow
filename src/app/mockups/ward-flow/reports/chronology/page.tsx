import type { Metadata } from "next";

import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";

export const metadata: Metadata = {
  title: "Patient chronology — Ward Flow",
  description: "Synthetic, printable post-incident review chronology for one patient in the Ward Flow prototype.",
};

/** `?patient=` carries a synthetic patient id only, never a name. */
export default async function WardPatientChronologyPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string | string[] }>;
}) {
  const { patient } = await searchParams;
  return <PatientChronologyScreen initialPatientId={typeof patient === "string" ? patient : undefined} />;
}
