import type { Metadata } from "next";

import { BedFlowProposalPreview } from "@/components/ward-management/bed-flow-proposal/bed-flow-proposal-preview";

export const metadata: Metadata = {
  title: "Network redesign preview — Ward Flow",
  description: "Proposed Network screen for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 Network redesign proposal. Reads live shared state only. */
export default async function NetworkProposalPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <BedFlowProposalPreview screen="network" view={view} />;
}
