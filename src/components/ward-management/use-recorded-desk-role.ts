"use client";

import type { WardFlowRole } from "./ward-flow-roles";
import { useEffectiveWardAccess } from "./shell/ward-access-store";
import { useWardFeatureFlag } from "./shell/ward-feature-flag-store";

/**
 * The role a step on another desk's route is recorded under. On a ward or ED route a coordinator's
 * screen acts as that route's role, and the shared server records the change as the coordinator's
 * (`deskCommand`, permission-matrix.md "Not covered"). The local demonstration has no server, so a
 * step that History names its actor by was recorded as the route's desk (Demo-Rules-LG-6, RV2-8,
 * 14 Nov 2026). With role access on and the coordinator's desk in force, this gives "coordinator",
 * as the server would; otherwise the route's role is kept unchanged.
 */
export function useRecordedDeskRole<R extends WardFlowRole>(routeRole: R): R | "coordinator" {
  const roleAccessOn = useWardFeatureFlag("role-access");
  const access = useEffectiveWardAccess();
  return roleAccessOn && access.role === "coordinator" ? "coordinator" : routeRole;
}
