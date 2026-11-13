"use client";

import type { WardAccess } from "../ward-role-access";
import type { WardChromeRole } from "../ward-chrome-role";
import { setWardAccess } from "../shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "../shell/ward-feature-flag-store";
import { dispatchPersonaSyncForRole } from "../settings/persona-sync";
import {
  currentDemoRoleSession,
  publishDemoRoleSession,
  writeDemoRoleSession,
  type DemoRoleSession,
} from "./ward-demo-role-session-store";

// The session store lives in its own file, so the app shell's Viewing as gate does not load the
// role switching below. Callers keep reading it from here.
export { useDemoRoleSession } from "./ward-demo-role-session-store";

function syncPersona(role: WardChromeRole, deskId?: string) {
  switch (role) {
    case "coordinator":
    case "ward":
    case "ed":
    case "community":
    case "officer":
      dispatchPersonaSyncForRole(role, deskId);
      break;
    default:
      dispatchPersonaSyncForRole("coordinator");
  }
}

/** Called only by the local-synthetic component, after its shared/session gates. */
export function selectDemoRole(next: WardAccess, original: DemoRoleSession) {
  writeDemoRoleSession(currentDemoRoleSession() ?? original);
  // In development this existing safeguard is initially off. Enable its real scoped view
  // for the demonstration; production's locked-on safeguard is never weakened.
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(next);
  syncPersona(
    next.role === "admin" ? "executive" : next.role,
    next.scope.kind === "ward" ? next.scope.unitIds[0] : next.scope.kind === "ed" ? next.scope.edId : undefined,
  );
  publishDemoRoleSession();
}

export function exitDemoRole(returnDesk?: WardAccess): WardAccess | null {
  const original = currentDemoRoleSession();
  if (!original) return null;
  writeDemoRoleSession(null);
  const desk = returnDesk ?? original.desk;
  setWardAccess(desk);
  syncPersona(
    desk === original.desk ? original.persona : desk.role === "admin" ? "executive" : desk.role,
    desk === original.desk ? original.personaDeskId : undefined,
  );
  setWardFeatureFlagOnDevice("role-access", original.deviceFlag);
  publishDemoRoleSession();
  return desk;
}
