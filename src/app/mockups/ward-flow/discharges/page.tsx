import type { Metadata } from "next";

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";

export const metadata: Metadata = {
  title: "Discharges — Ward Flow",
  description: "Synthetic, live discharge and departure board for the Ward Flow prototype — blocked releases first.",
};

/** `?admissionId=` (a synthetic admission id, never a name) opens that stay, as a Tasks row does. */
export default async function WardDischargesPage({
  searchParams,
}: {
  searchParams?: Promise<{ admissionId?: string | string[] }>;
}) {
  const { admissionId } = (await searchParams) ?? {};
  return <DischargeBoard initialAdmissionId={typeof admissionId === "string" ? admissionId : undefined} />;
}
