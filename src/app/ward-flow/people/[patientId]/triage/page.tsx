import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UMRN_IN_ADDRESS } from "@/components/ward-management/ward-patients";
import { TriageScreen } from "@/components/ward-management/triage/triage-risk-form";
import { decodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";

/**
 * Triage and risk (Josh's approved mock-up, built 7 Nov 2026): one person's triage form, opened blank.
 * The address carries the record code (D-39), as the patient page does; it names a person, never a
 * movement or a UMRN.
 */
export const metadata: Metadata = {
  title: "Triage and risk — Ward Flow",
  description: "Synthetic prototype: the mental health triage and risk assessment (SMHMR900 and SMHMR905).",
};

export default async function WardTriagePage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  let segment: string;
  try {
    segment = decodeURIComponent(patientId);
  } catch {
    notFound();
  }
  const id = decodeRecordAddress(segment) ?? segment;
  // As the patient page: a UMRN in the address is not resolved, and only a person id opens a triage.
  if (UMRN_IN_ADDRESS.test(id) || !id.startsWith("PT-")) notFound();
  return <TriageScreen patientId={id} />;
}
