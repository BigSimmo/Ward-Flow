import type { Metadata } from "next";

import { parseMockupOption } from "@/components/ward-management/preview/preview-option";
import { PatientNowPreview } from "@/components/ward-management/preview/patient-now-preview";

export const metadata: Metadata = {
  title: "Patient Now mockup - Ward Flow",
  description: "Preview only: three options for the Patient page Now tab, on synthetic records.",
};

/** Preview-only mockup route (device audit 11 Oct 2026). Not in the navigation. */
export default async function PatientNowPreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ option?: string; patient?: string }>;
}) {
  const query = await searchParams;
  const requested = query?.patient ?? "PT-001";
  const patientId = /^(PT|WF)-[0-9A-Za-z-]+$/u.test(requested) ? requested : "PT-001";
  return <PatientNowPreview option={parseMockupOption(query?.option)} patientId={patientId} />;
}
