import type { Metadata } from "next";

import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";

export const metadata: Metadata = {
  title: "Forms — Ward Flow",
  description:
    "Synthetic prototype: every open movement that carries a legal form, ordered by time remaining, honest about which form types this model can never put a deadline against.",
};

/** `?movement=` (a synthetic movement id, never a name) opens that patient, as a Governance gap does. */
export default async function WardLegalFormsPage({
  searchParams,
}: {
  searchParams?: Promise<{ movement?: string | string[] }>;
}) {
  const { movement } = (await searchParams) ?? {};
  return <LegalFormsScreen initialMovementId={typeof movement === "string" ? movement : undefined} />;
}
