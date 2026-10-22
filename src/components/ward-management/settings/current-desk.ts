import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";

/**
 * Which desk the current route is, kept apart from `workstation-desks.ts` so the shell's
 * broadcast banner and rail, which every page loads, do not pull the desk drawer's lists and
 * action table into each page's first load (phone script budget, 22 Oct 2026).
 */
export const COORDINATOR_DESK_ID = "coordinator";
export const OFFICER_DESK_ID = "officer";

/**
 * Which desk the current route is. Ward, ED, team and officer routes name their own desk; every
 * other route is the coordinator's (`wardChromeRole`), except the community index, which is a list
 * of teams rather than one team's desk.
 */
export function currentDeskId(pathname: string): string | null {
  const segment = (pattern: RegExp) => {
    const match = pattern.exec(pathname);
    return match ? decodeURIComponent(match[1]) : null;
  };
  const role = wardChromeRole(pathname);
  if (role === "ed") return segment(/\/ed\/([^/?#]+)/);
  if (role === "ward") return segment(/\/(?:ward|board)\/([^/?#]+)/);
  if (role === "community") return segment(/\/community\/([^/?#]+)/);
  if (role === "officer") return OFFICER_DESK_ID;
  return COORDINATOR_DESK_ID;
}
