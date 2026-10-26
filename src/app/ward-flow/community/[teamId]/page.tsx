import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { safeDecodeURIComponent } from "@/components/ward-management/ward-safe-url";

type Props = { params: Promise<{ teamId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { teamId } = await params;
  const id = safeDecodeURIComponent(teamId);
  const team = communityTeamById(id);
  // DR-20: an unknown id never reaches the title; the address text is whatever was typed.
  if (!team) return { title: "Community team not found — Ward Flow" };
  const name = team.name;
  return {
    title: `${name} — Ward Flow`,
    description: `Synthetic single-team community mental health view for ${name} in the Ward Flow prototype.`,
  };
}

export default async function CommunityTeamPage({ params }: Props) {
  const teamId = safeDecodeURIComponent((await params).teamId);
  // DA-32: an address that names no community team shows "Page not found", not a page reporting success.
  if (!communityTeamById(teamId)) notFound();
  return <CommunityScreen teamId={teamId} />;
}
