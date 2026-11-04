import type { Metadata } from "next";

import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { recordIdFromAddress } from "@/components/ward-management/shell/ward-record-address";

export const metadata: Metadata = {
  title: "Legal forms — Ward Flow",
  description:
    "Synthetic prototype: recorded mental health form times for open movements, copied from the paper form. No legal time limits are calculated.",
};

/**
 * `?movement=` (a synthetic movement id, never a name) opens that patient, as a Governance gap does.
 * `&record=1` also opens Record a form for that movement, as the patient record's link does.
 */
export default async function WardLegalFormsPage({
  searchParams,
}: {
  searchParams?: Promise<{ movement?: string | string[]; record?: string | string[] }>;
}) {
  const { movement, record } = (await searchParams) ?? {};
  return (
    <LegalFormsScreen
      initialMovementId={typeof movement === "string" ? recordIdFromAddress(movement) : undefined}
      recordOnOpen={record === "1"}
    />
  );
}
