import type { Metadata } from "next";

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { recordIdFromAddress } from "@/components/ward-management/shell/ward-record-address";

export const metadata: Metadata = {
  title: "Discharges — Ward Flow",
  description: "Synthetic discharges for the Ward Flow prototype, held-up discharges first.",
};

/** `?admissionId=` (a synthetic admission id, never a name) opens that stay, as an Alerts row does. */
export default async function WardDischargesPage({
  searchParams,
}: {
  searchParams?: Promise<{ admissionId?: string | string[] }>;
}) {
  const { admissionId } = (await searchParams) ?? {};
  return (
    <DischargeBoard
      initialAdmissionId={typeof admissionId === "string" ? recordIdFromAddress(admissionId) : undefined}
    />
  );
}
