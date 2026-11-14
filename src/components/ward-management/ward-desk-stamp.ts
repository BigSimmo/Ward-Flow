/**
 * **EVERY SAVE NAMES THE DESK THAT MADE IT (D-222, R-STRUCT-6).**
 *
 * `stampDesk` writes the session desk onto a change at the one place every change passes: the
 * provider's routing point in the demo, and the shared server's command path when signed in. The
 * History line then names the desk from the session, never from a role a screen typed.
 *
 * - `event.role` becomes the role the desk records under (`recordedRole`, `ward-permit.ts`), so the
 *   reducer refuses exactly what the server refuses. A coordinator's step on a ward page is recorded
 *   as the coordinator, as the signed-in server already does (`deskCommand`).
 * - `event.desk` keeps the desk's own role and place, which `auditActor` (`ward-audit.ts`) reads.
 *
 * Kept roles: a few changes use the typed role to choose the step, not to say who acted. For those
 * a coordinator keeps the typed role and the desk stamp still names the coordinator
 * (`COORDINATOR_STEP_ROLES`). Pure and browser free: the server bundles it through the engine.
 */
import type { Desk } from "@/components/ward-management/ward-desk";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { recordedRole } from "@/components/ward-management/ward-permit";
import { stampableAccountName, type DeskStamp } from "@/components/ward-management/ward-desk-stamp-shape";

/**
 * Changes whose typed role picks the step rather than naming who acted. A coordinator keeps the
 * typed role for these; every other desk records under its own role.
 */
export const COORDINATOR_STEP_ROLES: readonly {
  readonly type: WardFlowEvent["type"];
  readonly role: WardFlowRole;
  readonly reason: string;
}[] = [
  {
    type: "PATIENT_ARRIVED",
    role: "officer",
    reason: "The officer's Delivered step ends the transport leg only; the ward records the arrival.",
  },
  {
    type: "MARK_NOTICE_READ",
    role: "coordinator",
    reason: "The role names the notice's addressee, so a coordinator reads any desk's notice as that desk.",
  },
];

function keepsTypedRole(desk: Desk, event: WardFlowEvent): boolean {
  if (desk.access.role !== "coordinator") return false;
  if (event.type === "MARK_NOTICE_READ") return true;
  return COORDINATOR_STEP_ROLES.some((entry) => entry.type === event.type && entry.role === event.role);
}

/**
 * The role the change is recorded under for this desk. The server's `deskCommand` and the demo's
 * routing point both ask this, so the two record the same role.
 */
export function stampedRole(desk: Desk, event: WardFlowEvent): WardFlowRole {
  // A demonstration control sent as `demo` stays so; sent under any other role it is recorded under
  // the desk's own, so the stamp never turns another role into `demo` and the reducer refuses it.
  if (EVENT_ROLE[event.type]?.includes("demo")) return event.role === "demo" ? "demo" : desk.role;
  return keepsTypedRole(desk, event) ? event.role : recordedRole(desk, event.type);
}

/**
 * The change as `desk` makes it: recorded role, and the desk stamp History reads. No desk (the
 * role-access switch off, or a test) leaves the change exactly as sent. A stamp the sender supplied
 * is always replaced, so a change can never name a desk it did not come from.
 */
export function stampDesk<E extends WardFlowEvent>(event: E, desk: Desk | null, account?: string | null): E {
  if (desk === null) return event;
  const name = stampableAccountName(account);
  const stamp: DeskStamp = {
    role: desk.role,
    scope: desk.access.scope,
    ...(desk.access.role === "admin" ? { accessAdmin: true as const } : {}),
    ...(name === null ? {} : { account: name }),
  };
  return { ...event, role: stampedRole(desk, event), desk: stamp };
}
