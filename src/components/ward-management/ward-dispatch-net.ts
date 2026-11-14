/**
 * **THE DISPATCH SAFETY NET — the local demo refuses what the signed-in server refuses (R-STRUCT-1, D-223).**
 *
 * The shared server asks `permit()` (`ward-permit.ts`) before the reducer. The local demo has no
 * server, so a control a screen forgot to gate used to save there and fail only when signed in
 * (AC1-2). `dispatchNetRefusal` asks the same `permit()` at the one local dispatch point
 * (`useSliceGatedDispatch`), with the same words, for every desk short of the whole network.
 *
 * Kept out of the net: the whole network (the server asks it nothing), and the demonstration
 * controls (clock, reset, scenario), which the public demo offers every desk preview and the server
 * keeps to its own demo switch. A refusal here is a missed gate on a screen, so development builds
 * also log `ungated control: <TYPE>`.
 *
 * Pure. The shared server never calls this; it runs `commandRefusal`.
 */
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { deskFor } from "@/components/ward-management/ward-desk";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { permit, type Change } from "@/components/ward-management/ward-permit";
import { accessIsWholeNetwork, type WardAccess } from "@/components/ward-management/ward-role-access";

const CHROME_ROLES: readonly WardChromeRole[] = [
  "coordinator",
  "ward",
  "ed",
  "officer",
  "community",
  "bed_manager",
  "executive",
];

function chromeRole(role: unknown): WardChromeRole | undefined {
  return (CHROME_ROLES as readonly unknown[]).includes(role) ? (role as WardChromeRole) : undefined;
}

/** The server's refusal of this event from this desk, or null when the local demo may run it. */
export function dispatchNetRefusal(access: WardAccess, event: WardFlowEvent): string | null {
  if (accessIsWholeNetwork(access) || !Object.hasOwn(EVENT_ROLE, event.type)) return null;
  if ((EVENT_ROLE[event.type] as readonly string[]).includes("demo")) return null;
  // A coordinator's lens is the role its screen sent (as on the server, which records the coordinator).
  const desk = deskFor(access, { routeRole: chromeRole(event.role), canSwitch: false });
  // The role phase only, for now: a screen reaches the place rules through `usePermit` and
  // `GatedAction`. Running them here too refused the ward's own Pull the bed (it names the referral's
  // ED, which the server's acting-place rule also refuses), so that gap is reported, not hidden.
  const answer = permit(desk, event as unknown as Change);
  if (answer.kind === "allow") return null;
  if (process.env.NODE_ENV === "development") console.warn(`ungated control: ${event.type}`);
  return answer.refusal;
}
