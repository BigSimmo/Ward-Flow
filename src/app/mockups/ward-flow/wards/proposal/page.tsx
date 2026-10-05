import type { Metadata } from "next";

import { WardPagesProposalPreview } from "@/components/ward-management/wards/proposal/ward-pages-proposal-preview";

export const metadata: Metadata = {
  title: "Ward pages redesign preview — Ward Flow",
  description:
    "Proposed Ward Hub, ward, bed requests and bed board screens for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 ward pages redesign proposal. Reads live shared state only. */
export default async function WardPagesProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; id?: string }>;
}) {
  const { screen, id } = await searchParams;
  return <WardPagesProposalPreview screen={screen} id={id} />;
}
