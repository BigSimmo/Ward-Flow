import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";
import { ACCESS_ROLE_LABELS, ROLE_SCREENS, type WardAccessRole } from "@/components/ward-management/ward-role-access";
import { DESK_GUIDES } from "./ward-help-guide";

export type RoleReferenceEntry = { readonly id: WardAccessRole | "tv"; readonly name: string; readonly summary: string };

/** Help names: the menu label, and "Access admin" for admin. Summaries reuse each desk guide. */
function helpRoleName(role: WardAccessRole): string {
  return role === "admin" ? ACCESS_ROLE_LABELS.admin : CHROME_ROLE_LABELS[role];
}

export const TV_BOARD_SUMMARY =
  "The TV view puts the bed meeting on a wall screen. It is for looking at together, not for recording.";

export const ROLE_REFERENCE: readonly RoleReferenceEntry[] = [
  ...(Object.keys(ROLE_SCREENS) as WardAccessRole[]).map((role) => ({
    id: role,
    name: helpRoleName(role),
    summary: DESK_GUIDES[role].summary,
  })),
  { id: "tv", name: "TV board", summary: TV_BOARD_SUMMARY },
];
