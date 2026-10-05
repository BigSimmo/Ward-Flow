import type { Metadata } from "next";

import { EdProposalPreview } from "@/components/ward-management/ed/proposal/ed-proposal-preview";

export const metadata: Metadata = {
  title: "ED redesign preview - Ward Flow",
  description:
    "Proposed ED Hub and emergency department screens for review, built on the live synthetic Ward Flow state.",
};

/** Preview route for the 5 October 2026 ED Hub and department redesign proposal. Reads shared state only. */
export default async function EdProposalPage({ searchParams }: { searchParams: Promise<{ ed?: string }> }) {
  const { ed } = await searchParams;
  return <EdProposalPreview edId={ed} />;
}
