import type { Metadata } from "next";

import { StatisticsProposalPreview } from "@/components/ward-management/statistics/proposal/statistics-proposal-preview";

export const metadata: Metadata = {
  title: "Statistics redesign preview — Ward Flow",
  description: "Proposed statistics screens for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 statistics redesign proposal. Reads live shared state only. */
export default async function StatisticsProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; id?: string }>;
}) {
  const { screen, id } = await searchParams;
  return <StatisticsProposalPreview screen={screen} id={id} />;
}
