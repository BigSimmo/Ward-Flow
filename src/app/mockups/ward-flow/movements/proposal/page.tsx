import type { Metadata } from "next";

import { MovementProposalPreview } from "@/components/ward-management/movements/proposal/movement-proposal-preview";

export const metadata: Metadata = {
  title: "Movement record preview — Ward Flow",
  description: "Proposed record for one movement, built on the live synthetic Ward Flow state.",
};

/** Preview route for the proposed movement record (5 October 2026). Reads live shared state only. */
export default async function MovementsProposalPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <MovementProposalPreview id={id} />;
}
