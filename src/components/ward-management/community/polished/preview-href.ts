import type { CommunityTeam } from "@/components/ward-management/community/community-derivations";

/** Team links inside the polished preview stay inside the preview, so the real pages stay untouched. */
export function communityTeamHref(team: CommunityTeam): string {
  return `/mockups/ward-flow/community/proposal/${encodeURIComponent(team.id)}`;
}
