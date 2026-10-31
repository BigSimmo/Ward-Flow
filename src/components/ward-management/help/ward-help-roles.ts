import { ACCESS_ROLE_LABELS, ROLE_SCREENS, type WardAccessRole } from "@/components/ward-management/ward-role-access";
import { DESK_GUIDES } from "./ward-help-guide";

export type RoleReferenceEntry = {
  readonly id: WardAccessRole | "tv";
  readonly name: string;
  readonly summary: string;
};

/**
 * Each login's name in Help (Josh, 31 Oct 2026): the access names, so "Site bed manager" and
 * "Nurse in charge", and "Community team" for the community desk.
 */
export function helpDeskLabel(role: WardAccessRole): string {
  return role === "community" ? "Community team" : ACCESS_ROLE_LABELS[role];
}

const TV_BOARD_SUMMARY =
  "The TV view puts the bed meeting on a wall screen. It is for looking at together, not for recording.";

/** Summaries reuse each desk guide. */
export const ROLE_REFERENCE: readonly RoleReferenceEntry[] = [
  ...(Object.keys(ROLE_SCREENS) as WardAccessRole[]).map((role) => ({
    id: role,
    name: helpDeskLabel(role),
    summary: DESK_GUIDES[role].summary,
  })),
  { id: "tv", name: "TV board", summary: TV_BOARD_SUMMARY },
];
