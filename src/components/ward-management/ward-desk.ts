/**
 * **THE DESK A CHANGE COMES FROM — one session source for permissions and History (R-STRUCT-1, R-STRUCT-3).**
 *
 * Owner rulings D-222 and D-223 (Josh, 14 Nov 2026): the actor comes from the session, never from a
 * role a screen typed. This module is that one source. `permit()` (`ward-permit.ts`) asks it which
 * role gates a control, and History's `stampDesk` asks it which role and place a save is recorded
 * under. Both the shell and the shared server build a `Desk` with `deskFor`, so the two cannot
 * disagree about who is acting.
 *
 * Two roles, on purpose:
 * - `role` is the membership's own role. It is what a save is RECORDED under, on the server and in
 *   History. The access admin has no clinical role and reads as the executive (as
 *   `chromeRoleForAccess` does), except for the one action D-142 gives it, which the server stamps.
 * - `actsAs` is the lens a screen GATES under. A coordinator on a ward or ED route keeps today's
 *   behaviour and is gated as that desk, while the server still records the coordinator
 *   (`deskCommand`, `backend/ward-flow/engine.ts`). Every other desk acts only as itself.
 *
 * Pure and browser free: the backend bundles it through `build-engine.mjs`.
 */
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

export type Desk = {
  /** The membership: role and place. On the signed-in site this is the server's truth. */
  readonly access: WardAccess;
  /** The role a save is recorded under: the membership's own (`deskRoleForAccess`). History stamps this. */
  readonly role: WardChromeRole;
  /** The role a screen gates controls under. Differs from `role` only for a coordinator on another desk's route. */
  readonly actsAs: WardChromeRole;
  /** Whether this desk may switch to another desk's view, so a step it cannot take is "not now", not "never". */
  readonly canSwitch: boolean;
};

/**
 * The role a membership records its saves under. The access admin has no clinical role, so it reads
 * as the executive, which takes no workflow action. Same mapping as `chromeRoleForAccess`
 * (`shell/ward-access-store.ts`), here without the browser store so the server can import it.
 */
export function deskRoleForAccess(access: WardAccess): WardChromeRole {
  return access.role === "admin" ? "executive" : access.role;
}

/**
 * The desk for a membership. `routeRole` is the role the route (or an in-page desk switch) gives; it
 * changes the gating lens of a coordinator only, as `useAccessShellRole` does today. `canSwitch`
 * is the session's own answer when a shared session says whether it can switch desk; left out, only
 * a coordinator may switch (today's `useRoleGate`).
 */
export function deskFor(
  access: WardAccess,
  options: { readonly routeRole?: WardChromeRole; readonly canSwitch?: boolean } = {},
): Desk {
  const role = deskRoleForAccess(access);
  return {
    access,
    role,
    actsAs: access.role === "coordinator" ? (options.routeRole ?? role) : role,
    canSwitch: options.canSwitch ?? access.role === "coordinator",
  };
}
