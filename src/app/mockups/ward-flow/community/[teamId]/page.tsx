import type { Metadata } from "next";

import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { safeDecodeURIComponent } from "@/lib/safe-url";

type Props = { params: Promise<{ teamId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { teamId } = await params;
  const id = safeDecodeURIComponent(teamId);
  const team = communityTeamById(id);
  const name = team?.name ?? id;
  return {
    title: `${name} - Ward Flow`,
    description: `Synthetic single-team community mental health view for ${name} in the Ward Flow prototype.`,
  };
}

export default async function CommunityTeamPage({ params }: Props) {
  const { teamId } = await params;
  return <CommunityScreen teamId={safeDecodeURIComponent(teamId)} />;
}
