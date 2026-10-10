/**
 * **WHICH ACTIONS THE ROLE ON THIS ROUTE MAY TAKE — feature 11, actions limited by role.**
 *
 * The role is the route (`ward-chrome-role.ts`). What a role may do is the reducer's `EVENT_ROLE`
 * table (`ward-flow-events.ts`), pinned by hand in `tests/ward-event-permissions.test.ts`. This
 * module joins the two, so a screen asks one question, `canDispatch(routeRole, eventType)`, and
 * never restates a role list of its own.
 *
 * ⚠️ **THE REDUCER STAYS THE GATE.** `wardFlowReducer` refuses any event whose `role` is not in
 * `EVENT_ROLE` for that type and records a `Rejection`. These helpers decide whether a button is
 * offered; they never widen what the reducer accepts. `EVENT_ROLE` is not edited here.
 *
 * ⚠️ **`CROSS_ROLE_ALLOWED` IS THE ONE PLACE A ROUTE MAY ACT FOR ANOTHER ROLE.** Some screens that
 * people use today dispatch under a role other than the route's own (a borrowed identity): the
 * Patient page, Legal forms, the ward's Raise referral and the New referral sheet. Josh has not yet
 * chosen, for each, between a dedicated route for that role and widening `EVENT_ROLE`. Until he
 * does, each such pair is listed below with its reason, so the exceptions are explicit and
 * reviewable rather than scattered. Anything not in the table is limited strictly to `EVENT_ROLE`.
 */
import { EVENT_ROLE, type WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";

export type WardFlowEventType = WardFlowEvent["type"];

export type CrossRoleAllowance = {
  /** The route's own role (`wardChromeRole`). */
  readonly routeRole: WardChromeRole;
  readonly event: WardFlowEventType;
  /** Where the borrowed role is used and why it stays working for now. */
  readonly reason: string;
};

const PATIENT_PAGE = "Patient page (coordinator route) acts for";
const REFERRAL_SHEET =
  "New referral is on every page (Josh, 9 Oct 2026); the sheet dispatches as the referral's source (ED or community), chosen in the form";

/**
 * Open questions for Josh, one per pair: a dedicated route for that role, or an `EVENT_ROLE`
 * widening (with a ruling and a `tests/ward-event-permissions.test.ts` change). Removing a pair
 * here turns its buttons into disabled "… only" controls on that route; it needs no screen edit.
 */
export const CROSS_ROLE_ALLOWED: readonly CrossRoleAllowance[] = [
  // Patient page placement and transport panel (`patient-transit-operations.tsx`) and its status card.
  { routeRole: "coordinator", event: "ACCEPT_IN_PRINCIPLE", reason: `${PATIENT_PAGE} the receiving ward: Accept bed` },
  {
    routeRole: "coordinator",
    event: "BOOK_TRANSPORT",
    reason: `${PATIENT_PAGE} the sending ED: log a transport booking`,
  },
  { routeRole: "coordinator", event: "HANDOVER_READY", reason: `${PATIENT_PAGE} the sending ED: Mark handover ready` },
  { routeRole: "coordinator", event: "TRANSPORT_ACCEPTED", reason: `${PATIENT_PAGE} the transport officer` },
  { routeRole: "coordinator", event: "TRANSPORT_EN_ROUTE", reason: `${PATIENT_PAGE} the transport officer` },
  { routeRole: "coordinator", event: "PATIENT_COLLECTED", reason: `${PATIENT_PAGE} the transport officer` },
  { routeRole: "coordinator", event: "PATIENT_ARRIVED", reason: `${PATIENT_PAGE} the receiving ward: Confirm arrival` },
  // D-38 stay actions on the Patient page, recorded as the ward the stay is on.
  { routeRole: "coordinator", event: "END_LEAVE_BED", reason: `${PATIENT_PAGE} the ward: Record return (D-38)` },
  {
    routeRole: "coordinator",
    event: "RECORD_ABSENT_WITHOUT_LEAVE",
    reason: `${PATIENT_PAGE} the ward: Mark absent (D-38)`,
  },
  {
    routeRole: "coordinator",
    event: "RECORD_ABSENCE_STEP",
    reason: `${PATIENT_PAGE} the ward: missing person steps (D-38)`,
  },
  // Ward changes on the Patient page (Josh, 10 Oct 2026), recorded as the ward the stay is on.
  { routeRole: "coordinator", event: "RECORD_LEAVE_BED", reason: `${PATIENT_PAGE} the ward: Start leave` },
  {
    routeRole: "coordinator",
    event: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
    reason: `${PATIENT_PAGE} the ward: Gone to ED`,
  },
  {
    routeRole: "coordinator",
    event: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
    reason: `${PATIENT_PAGE} the ward: Record return from ED`,
  },
  // Legal forms board (coordinator route): Mark received is recorded as the ED.
  {
    routeRole: "coordinator",
    event: "RECORD_LEGAL_FORM_RECEIVED",
    reason: "Legal forms (coordinator route) acts for the ED: Mark received",
  },
  // Ward screen Raise referral: a ward-to-ward referral is received as `community` with source
  // `psychiatric_ward`; `EVENT_ROLE.RECEIVE_REFERRAL` has no `ward`.
  {
    routeRole: "ward",
    event: "RECEIVE_REFERRAL",
    reason: "Ward screen Raise referral and the New referral sheet dispatch as community",
  },
  // New referral sheet (`ward-referral-drawer.tsx`), on routes whose role `EVENT_ROLE` omits.
  { routeRole: "coordinator", event: "RECEIVE_REFERRAL", reason: REFERRAL_SHEET },
  { routeRole: "officer", event: "RECEIVE_REFERRAL", reason: REFERRAL_SHEET },
  { routeRole: "ward", event: "ADD_PATIENT", reason: REFERRAL_SHEET },
  { routeRole: "officer", event: "ADD_PATIENT", reason: REFERRAL_SHEET },
];

/** The allowance that lets `role` dispatch `eventType` outside `EVENT_ROLE`, if any. */
export function crossRoleAllowance(role: WardFlowRole, eventType: WardFlowEventType): CrossRoleAllowance | undefined {
  return CROSS_ROLE_ALLOWED.find((entry) => entry.routeRole === role && entry.event === eventType);
}

/** Whether the role on this route may take an action that dispatches `eventType`. */
export function canDispatch(role: WardFlowRole, eventType: WardFlowEventType): boolean {
  return EVENT_ROLE[eventType].includes(role) || crossRoleAllowance(role, eventType) !== undefined;
}

/** Short names for "… only" reasons. `demo` belongs to nobody's clinical role and is never named. */
const SHORT_ROLE_NAMES: Record<WardFlowRole, string> = {
  coordinator: "coordinator",
  ward: "ward",
  ed: "ED",
  officer: "transport officer",
  community: "community team",
  bed_manager: "bed manager",
  executive: "executive",
  demo: "demonstration control",
};

/** "Coordinator only", "Ward or coordinator only", "ED, ward or community team only". */
export function rolesOnlyReason(roles: readonly WardFlowRole[]): string {
  const named = roles.filter((role) => role !== "demo").map((role) => SHORT_ROLE_NAMES[role]);
  const list =
    named.length === 0
      ? SHORT_ROLE_NAMES.demo
      : named.length === 1
        ? named[0]
        : `${named.slice(0, -1).join(", ")} or ${named.at(-1)}`;
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} only`;
}

export type DispatchPermission = { allowed: true } | { allowed: false; reason: string };

/** Whether `role` may dispatch `eventType`, and when not, the short reason a disabled control shows. */
export function dispatchPermission(role: WardFlowRole, eventType: WardFlowEventType): DispatchPermission {
  if (canDispatch(role, eventType)) return { allowed: true };
  return { allowed: false, reason: rolesOnlyReason(EVENT_ROLE[eventType]) };
}

/** The disabled reason for `eventType` on `role`, or undefined when the action is available. */
export function roleLimitReason(role: WardFlowRole, eventType: WardFlowEventType): string | undefined {
  const permission = dispatchPermission(role, eventType);
  return permission.allowed ? undefined : permission.reason;
}
