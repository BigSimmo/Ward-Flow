import type { Metadata } from "next";

import { CommunityScreenPolished } from "@/components/ward-management/community/polished/community-screen-polished";

export const metadata: Metadata = {
  title: "Community team polish preview — Ward Flow",
  description: "The current community team page, polished in place, built on the live synthetic Ward Flow state.",
};

type Props = { params: Promise<{ teamId: string }> };

/** Preview route for the polished team page (same structure as the current page). The current `community/[teamId]` page is unchanged. */
export default async function CommunityTeamProposalPage({ params }: Props) {
  const { teamId } = await params;
  return <CommunityScreenPolished teamId={decodeURIComponent(teamId)} />;
}
