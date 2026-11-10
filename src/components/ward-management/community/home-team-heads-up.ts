import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import type { PatientId } from "@/components/ward-management/ward-patients";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { namesTeam, type CommunityTeam } from "./community-derivations";

/**
 * HOME TEAM HEADS-UP (item 46, D-133, Josh 10 Nov 2026). When a person with an OPEN community team
 * episode is recorded in an emergency department, that team's page lists "Your patient is in
 * Armadale ED since 08:22".
 *
 * Derived each render from the recorded ED stay; nothing is stored and no event is raised. Each item
 * holds the ED name and the time the stay was recorded, and nothing else: no reason, diagnosis, risk
 * or typed text (D-133). Only an open (`active`) episode with this team raises one; an ended
 * episode, or one with another team, raises nothing. Items keep the record order: no sort, no rank.
 */
export type HomeTeamHeadsUp = { key: string; edName: string; since: Instant };

/** One community team episode as the patient record holds it: the team by name, open or ended. */
export type CommunityEpisode = { status: "active" | "ended"; team: string };
export type CommunityEpisodesOf = (patientId: PatientId) => readonly CommunityEpisode[] | undefined;

type HeadsUpMovement = Pick<
  Movement,
  "id" | "patientId" | "originEdId" | "stage" | "closure" | "leftDepartmentAt" | "openedAt"
>;

/** Still in the emergency department: opened there, not moving or arrived, not closed or left. */
function inEmergencyDepartment(movement: HeadsUpMovement, now: Instant): boolean {
  return (
    movement.originEdId !== undefined &&
    movement.stage !== "moving" &&
    movement.stage !== "arrived" &&
    movement.closure === undefined &&
    movement.leftDepartmentAt === undefined &&
    movement.openedAt <= now
  );
}

/**
 * The record names a team ("Midland Community Team"); the team page names the clinic ("Midland").
 * The exact or ratified name, then the place word, as the patient call list matches them.
 */
function episodeNamesTeam(name: string, team: CommunityTeam): boolean {
  if (namesTeam(name, team)) return true;
  const place = name.replace(/\s+Community(\s+Mental Health)?\s+(Team|Service)$/iu, "").trim();
  return place !== name && namesTeam(place, team);
}

export function homeTeamHeadsUps(
  movements: readonly HeadsUpMovement[],
  team: CommunityTeam,
  episodesOf: CommunityEpisodesOf,
  now: Instant,
): HomeTeamHeadsUp[] {
  const items: HomeTeamHeadsUp[] = [];
  for (const movement of movements) {
    if (movement.patientId === undefined || !inEmergencyDepartment(movement, now)) continue;
    const open = (episodesOf(movement.patientId) ?? []).some(
      (episode) => episode.status === "active" && episodeNamesTeam(episode.team, team),
    );
    if (!open) continue;
    const ed = edById(movement.originEdId);
    if (ed === undefined) continue;
    items.push({ key: movement.id, edName: edShortName(ed), since: movement.openedAt });
  }
  return items;
}

/** "Your patient is in Armadale ED since 08:22": the ED name and the time, as D-133 allows. */
export function homeTeamHeadsUpSentence(item: HomeTeamHeadsUp, time: string): string {
  return `Your patient is in ${item.edName} since ${time}`;
}
