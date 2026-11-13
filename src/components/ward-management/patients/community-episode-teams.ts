import type { CommunityEpisode, CommunityEpisodesOf } from "@/components/ward-management/community/home-team-heads-up";

/**
 * MOCK-UP ONLY, like `patient-record-extras.ts`. The team and the open or ended status of each
 * invented community team episode, and nothing else. This is the only place they are typed:
 * the record extras spread these entries into their fuller mock-ups.
 *
 * The list is kept apart from the extras so the community desk's scoped view (D-154) can test
 * "open episode with this team" without loading the record mock-ups into every screen.
 */
export const COMMUNITY_EPISODE_TEAMS = {
  "PT-001": [{ status: "active", team: "Midland Community Team" }],
  "PT-003": [{ status: "ended", team: "Bentley Community Team" }],
  "PT-036": [{ status: "active", team: "Midland Community Team" }],
  "PT-002": [{ status: "active", team: "Midland Community Team" }],
} as const satisfies Record<string, readonly CommunityEpisode[]>;

const EPISODES: Readonly<Record<string, readonly CommunityEpisode[]>> = COMMUNITY_EPISODE_TEAMS;

/** The patient's community team episodes, team and status only, or `undefined` when none is recorded. */
export const communityEpisodeTeamsOf: CommunityEpisodesOf = (patientId) => EPISODES[patientId];
