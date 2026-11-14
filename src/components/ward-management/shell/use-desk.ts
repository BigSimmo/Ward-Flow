/**
 * The shell's `Desk` (`ward-desk.ts`): the effective membership, the route's gating lens and whether
 * this session can switch desk, the same three answers `useRoleGate` reads today. Phase 2 of the
 * permissions build (D-223) moves `useRoleGate` and History's dispatch stamp (D-222) onto it.
 */
import { useMemo } from "react";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { deskFor, type Desk } from "@/components/ward-management/ward-desk";
import { useDeskRoleSwitch, useRouteRole } from "@/components/ward-management/ward-role-gate";

export function useDesk(): Desk {
  const access = useEffectiveWardAccess();
  const routeRole = useRouteRole();
  const { shared, canSwitch } = useDeskRoleSwitch();
  // A shared session answers for itself whether it can switch desk; the local demo lets a coordinator switch.
  const sessionCanSwitch = shared ? canSwitch : undefined;
  return useMemo(
    () => deskFor(access, { routeRole, canSwitch: sessionCanSwitch }),
    [access, routeRole, sessionCanSwitch],
  );
}
