/**
 * WHAT A LOGIN MAY USE, AS HELP SEES IT (audit finding 11, Josh 31 Oct 2026): Help and the shortcuts
 * sheet offer a login only the tasks, keys and links its role can actually use. Two tables decide,
 * the same two the app enforces: `ROLE_SCREENS` (which screens a role opens) and `EVENT_ROLE` (which
 * roles may record each action). Help never widens either; it only reads them.
 */
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import {
  accessIsWholeNetwork,
  ROLE_SCREENS,
  STATEWIDE_COORDINATOR,
  WARD_ACCESS_ROLES,
  type WardAccess,
  type WardScreenId,
} from "@/components/ward-management/ward-role-access";

import { howToHref } from "./ward-help-href";
import type { HowTo } from "./ward-help-howto";
import type { WardTourRole } from "./ward-help-store";

export type WardEventType = WardFlowEvent["type"];

/** Whether this login opens `screen`. */
export function deskOpens(role: WardTourRole, screen: WardScreenId): boolean {
  return ROLE_SCREENS[role][screen] !== undefined;
}

/**
 * Whether this login may record at least one of `acts`. The access admin records no ward event, so
 * it is never in `EVENT_ROLE`.
 */
export function deskMayAct(role: WardTourRole, acts: readonly WardEventType[]): boolean {
  return acts.some((act) => (EVENT_ROLE[act] as readonly string[]).includes(role));
}

/** Every login, in the access table's order. */
export const EVERY_LOGIN: readonly WardTourRole[] = WARD_ACCESS_ROLES;

/**
 * Whether `howTo` is this login's own task: named for its desk, it may record what the task records,
 * and it opens every screen the task needs or sends it to. Anything else is another desk's job, which
 * Help still answers when searched for, but with no Show me or Go there.
 */
export function howToFor(howTo: HowTo, role: WardTourRole, access?: WardAccess): boolean {
  if (howTo.requiresWholeNetwork && (!access || access.role !== role || !accessIsWholeNetwork(access))) return false;
  if (howTo.desks !== "all" && !howTo.desks.includes(role)) return false;
  if (howTo.acts && !deskMayAct(role, howTo.acts)) return false;
  if (howTo.needs && !deskOpens(role, howTo.needs)) return false;
  // "home" always resolves for a signed-in desk, so any address stands in for it here.
  return !howTo.go || howToHref(howTo.go, role, "/ward-flow") !== undefined;
}

/**
 * Potential roles for descriptive search labels, including a coordinator in statewide scope.
 * This is not the current login's permission: action entry points must call howToFor with actual access.
 */
export function howToLogins(howTo: HowTo): readonly WardTourRole[] {
  return EVERY_LOGIN.filter((role) =>
    howToFor(howTo, role, role === "coordinator" ? STATEWIDE_COORDINATOR : undefined),
  );
}
