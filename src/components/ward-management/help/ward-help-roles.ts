import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";
import { ACCESS_ROLE_LABELS, ROLE_SCREENS, type WardAccessRole } from "@/components/ward-management/ward-role-access";
import { DESK_GUIDES } from "./ward-help-guide";

export type RoleReferenceEntry = {
  readonly id: WardAccessRole | "tv";
  readonly name: string;
  readonly summary: string;
};

/** Help keeps the short "Bed manager" while the menu says "Site bed manager" (the printed guides and their tests use it). */
export const HELP_BED_MANAGER_NAME = "Bed manager";

/** Help names: the menu label, "Access admin" for admin and "Bed manager" for the bed manager. Summaries reuse each desk guide. */
export function helpRoleName(role: WardAccessRole): string {
  if (role === "admin") return ACCESS_ROLE_LABELS.admin;
  if (role === "bed_manager") return HELP_BED_MANAGER_NAME;
  return CHROME_ROLE_LABELS[role];
}

const TV_BOARD_SUMMARY =
  "The TV view puts the bed meeting on a wall screen. It is for looking at together, not for recording.";

export const ROLE_REFERENCE: readonly RoleReferenceEntry[] = [
  ...(Object.keys(ROLE_SCREENS) as WardAccessRole[]).map((role) => ({
    id: role,
    name: helpRoleName(role),
    summary: DESK_GUIDES[role].summary,
  })),
  { id: "tv", name: "TV board", summary: TV_BOARD_SUMMARY },
];
