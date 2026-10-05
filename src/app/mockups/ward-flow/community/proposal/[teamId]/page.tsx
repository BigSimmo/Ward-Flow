import type { Metadata } from "next";

import { CommunityTeamProposal } from "@/components/ward-management/community/proposal/community-team-proposal";

export const metadata: Metadata = {
  title: "Community team redesign preview — Ward Flow",
  description: "Proposed single community team page for review, built on the live synthetic Ward Flow state.",
};

type Props = { params: Promise<{ teamId: string }> };

/** Preview route for the proposed team page. The current `community/[teamId]` page is unchanged. */
export default async function CommunityTeamProposalPage({ params }: Props) {
  const { teamId } = await params;
  return <CommunityTeamProposal teamId={decodeURIComponent(teamId)} />;
}
