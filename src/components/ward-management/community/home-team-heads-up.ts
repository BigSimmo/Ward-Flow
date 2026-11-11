import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import type { PatientId } from "@/components/ward-management/ward-patients";
import { isEdOriginJourney } from "@/components/ward-management/ward-ed-presence";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { namesTeam, type CommunityTeam } from "./community-derivations";

/**
 * HOME TEAM HEADS-UP (item 46, D-133, Josh 10 Nov 2026). When a person with an OPEN community team
 * episode is recorded in an emergency department, that team's page lists "Your patient is in
 * Armadale ED since 08:22".
 *
 * Derived each render from the recorded ED stay; nothing is stored and no event is raised. Each item
 * holds the patient's UMRN (D-141, Josh 11 Nov 2026, so a team can tell two items apart), the ED
 * name and the time the stay was recorded, and nothing else: no name, reason, diagnosis, risk or
 * typed text (D-133). Only an open (`active`) episode with this team raises one; an ended episode,
 * or one with another team, raises nothing. Items keep the record order: no sort, no rank.
 */
export type HomeTeamHeadsUp = { key: string; umrn?: string; edName: string; since: Instant };

/** The patient's UMRN, or `undefined` when none is recorded. */
export type UmrnOf = (patientId: PatientId) => string | undefined;

/** One community team episode as the patient record holds it: the team by name, open or ended. */
export type CommunityEpisode = { status: "active" | "ended"; team: string };
export type CommunityEpisodesOf = (patientId: PatientId) => readonly CommunityEpisode[] | undefined;

type HeadsUpMovement = Pick<
  Movement,
  "id" | "patientId" | "originEdId" | "sourceAdmissionId" | "stage" | "closure" | "leftDepartmentAt" | "openedAt"
>;

/**
 * Still in the emergency department: opened there, not moving or arrived, not closed or left. A
 * ward-to-ward transfer keeps an ED id for routing only; the person is still on the sending ward.
 */
function inEmergencyDepartment(movement: HeadsUpMovement, now: Instant): boolean {
  return (
    isEdOriginJourney(movement) &&
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
  umrnOf: UmrnOf = () => undefined,
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
    const umrn = recordedUmrn(umrnOf(movement.patientId));
    items.push({ key: movement.id, ...(umrn ? { umrn } : {}), edName: edShortName(ed), since: movement.openedAt });
  }
  return items;
}

/** A UMRN as recorded, or `undefined` for a blank or "not recorded" placeholder. */
function recordedUmrn(umrn: string | undefined): string | undefined {
  const trimmed = umrn?.trim();
  return trimmed && trimmed !== "UMRN not recorded" ? trimmed : undefined;
}

/**
 * "UM100001 is in Armadale ED since 08:22": the UMRN (D-141), the ED name and the time. With no
 * UMRN recorded it reads "Your patient is in Armadale ED since 08:22", as D-133 first allowed.
 */
export function homeTeamHeadsUpSentence(item: HomeTeamHeadsUp, time: string): string {
  return `${homeTeamHeadsUpWho(item)} is in ${item.edName} since ${time}`;
}

/** Who the sentence starts with: the UMRN, or "Your patient" when none is recorded. */
export function homeTeamHeadsUpWho(item: HomeTeamHeadsUp): string {
  return item.umrn ?? "Your patient";
}
