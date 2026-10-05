import type { Metadata } from "next";

import { MovementProposalPreview } from "@/components/ward-management/movements/proposal/movement-proposal-preview";

export const metadata: Metadata = {
  title: "Movements and transport redesign preview — Ward Flow",
  description:
    "Proposed movements, movement record and Transport Hub screens, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 movements and transport redesign proposal. Reads live shared state only. */
export default async function MovementsProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; id?: string }>;
}) {
  const { screen, id } = await searchParams;
  return <MovementProposalPreview screen={screen} id={id} />;
}
