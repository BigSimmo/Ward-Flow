/**
 * **ONE ANSWER TO "MAY THIS DESK MAKE THIS CHANGE?" — `permit()` (R-STRUCT-1, D-223, Josh 14 Nov 2026).**
 *
 * The screen asks it before it draws a control, and (phase 2) the shared server asks it before the
 * reducer, so the two give the same answer in the same words. Three phases, and the first refusal wins:
 *
 * 1. **Role.** The reducer's `EVENT_ROLE` table, read for the desk's gating lens (`Desk.actsAs`) and
 *    for the role the save is recorded under (`Desk.role`). Before it, in the server's own order,
 *    come the refusals `commandRefusal` makes first: the site feature switch, the access admin and
 *    the executive (who change nothing), the demonstration controls (the statewide coordinator's
 *    alone) and the outage record.
 * 2. **Place.** `PLACE_RULES` (`ward-permit-place-rules.ts`), the server's place rules as a table.
 *    Asked only when the caller hands in the records it holds.
 * 3. **Record.** `RECORD_CHECKS`: previews of a reducer refusal a screen would otherwise only learn
 *    about after the press. The reducer keeps every check it has; these never widen or replace one.
 *
 * Results follow D-192 item 5 as ruled again by Josh at 14:44Z on 14 Nov 2026: `never` is a step
 * this desk can never take (for this record or at all), so a screen hides it, with no "who does
 * this" line; `not-now` keeps the control, disabled, with its reason drawn under it. `refusal` is the
 * server's own words, for a save that reaches the dispatch safety net or the server; it is not drawn.
 *
 * PHASE 1: nothing calls this yet outside tests. Phase 2 moves `useRoleGate`, the dispatch safety net
 * and `commandRefusal` onto it.
 *
 * Pure and browser free. Must NOT import `ward-access-state.ts` (governance seed, phone budget).
 */
import type { Desk } from "@/components/ward-management/ward-desk";
import type { EligibilityGate } from "@/components/ward-management/ward-eligibility";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { deskRuleRefusal, placeRuleRefusal } from "@/components/ward-management/ward-permit-place-rules";
import { rolesOnlyReason, type WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import { accessIsWholeNetwork, unitInScope, type PlaceLookup } from "@/components/ward-management/ward-role-access";
import { SITE_FEATURE_SWITCH_ROLE } from "@/components/ward-management/ward-site-feature-switches";

/** The server's role refusal, word for word (`commandRefusal`). */
export const NOT_YOUR_ROLE = "This change is not part of your role.";
/** The server's answer to a change type it does not know. */
export const UNKNOWN_CHANGE = "This change is not one the workflow knows.";

/** A change as a screen builds it: no role and no time, which the shell stamps (History, D-222). */
export type Change = { readonly type: WardFlowEventType } & Readonly<Record<string, unknown>>;

export type Permit =
  | { readonly kind: "allow" }
  /** Hide the control, with no line in its place (Josh, 14 Nov 2026). */
  | { readonly kind: "never"; readonly refusal: string }
  /** Show the control disabled, with `reason` drawn under it. */
  | { readonly kind: "not-now"; readonly refusal: string; readonly reason: string };

/** The records a desk holds, for the place and record phases. Left out, only the role phase runs. */
export type PermitRecords = { readonly state: WardFlowState; readonly places: PlaceLookup };

const ALLOW: Permit = { kind: "allow" };

/** A demonstration control: clock, reset, scenario. `EVENT_ROLE` gives these to `demo` alone. */
function isDemonstrationControl(type: WardFlowEventType): boolean {
  return EVENT_ROLE[type].includes("demo");
}

/**
 * The role the server records this change under: the membership's (`Desk.role`), except the
 * demonstration controls (`demo`) and the access admin's site switch, which `deskCommand` sends under
 * the coordinator role (D-142).
 */
export function recordedRole(desk: Desk, type: WardFlowEventType): WardFlowRole {
  if (isDemonstrationControl(type)) return "demo";
  if (type === "SET_SITE_FEATURE_SWITCH" && desk.access.role === "admin") return SITE_FEATURE_SWITCH_ROLE;
  return desk.role;
}

function never(refusal: string): Permit {
  return { kind: "never", refusal };
}

/**
 * A record-state preview: a refusal the reducer would make, shown before the press. Each mirrors one
 * reducer check; the reducer stays the gate.
 */
export type RecordCheck = {
  readonly id: string;
  readonly types: readonly WardFlowEventType[];
  readonly check: (desk: Desk, change: Change, records: PermitRecords) => Permit | null;
};

export const RECORD_CHECKS: readonly RecordCheck[] = [
  {
    // X1b-6 (pinned allowed, D-223): the ward that accepted the person sets the arrival plan. Another
    // ward the person was only referred to never can (`SET_ARRIVAL_DETAILS` in
    // `ward-flow-transport-events.ts` refuses a ward that is not the accepted ward).
    id: "arrival-plan-accepting-ward",
    types: ["SET_ARRIVAL_DETAILS"],
    check: (desk, change, { state, places }) => {
      if (desk.role !== "ward") return null;
      const movement = state.movements.find((candidate) => candidate.id === change.movementId);
      if (!movement?.acceptedUnitId || unitInScope(desk.access.scope, movement.acceptedUnitId, places)) return null;
      return never("Only the ward that accepted this person sets the arrival plan.");
    },
  },
];

/**
 * D-223 (Josh, 14 Nov 2026), Together-X2-4: a planned admission's arrival recorded while the ward's
 * bed count is old may take a reason from the existing override list, for the bed-count check only.
 * The gender check stays non-overridable (T10), as does every other gate. Phase 2 hands this list to
 * the conversion in `capacity/planned-admissions-reducer.ts`; until then the arrival is refused there.
 */
export const PLANNED_ARRIVAL_OVERRIDABLE_GATES = ["capacity_freshness"] as const satisfies readonly EligibilityGate[];

/** May `desk` make `change`? See the module comment for the three phases. */
export function permit(desk: Desk, change: Change, records?: PermitRecords): Permit {
  const type = change.type;
  if (!Object.hasOwn(EVENT_ROLE, type)) return never(UNKNOWN_CHANGE);
  const roles = EVENT_ROLE[type] as readonly WardFlowRole[];
  const access = desk.access;
  const wholeNetwork = accessIsWholeNetwork(access);

  // 1a. What the server refuses before the role, in its order (`commandRefusal`).
  if (!wholeNetwork) {
    const refused = deskRuleRefusal(access, change);
    // The server answers the site switch here and asks nothing else.
    if (type === "SET_SITE_FEATURE_SWITCH") return refused ? never(refused.refusal) : ALLOW;
    if (access.role === "admin" || access.role === "executive" || isDemonstrationControl(type))
      return never(NOT_YOUR_ROLE);
    if (refused) return never(refused.refusal);
  } else if (isDemonstrationControl(type)) return ALLOW;

  // 1b. The role. The recorded role is what the reducer checks; the lens is what the screen shows.
  if (!roles.includes(recordedRole(desk, type)) || !roles.includes(desk.actsAs)) {
    if (desk.canSwitch) return { kind: "not-now", refusal: NOT_YOUR_ROLE, reason: rolesOnlyReason(roles) };
    return never(NOT_YOUR_ROLE);
  }
  if (!records) return ALLOW;

  // 2. The place. The whole network is never refused here (the server returns before its scope check).
  const place = placeRuleRefusal({ state: records.state, access, command: change, places: records.places });
  if (place) return never(place.refusal);

  // 3. Record-state previews.
  for (const check of RECORD_CHECKS) {
    if (!check.types.includes(type)) continue;
    const answer = check.check(desk, change, records);
    if (answer) return answer;
  }
  return ALLOW;
}
