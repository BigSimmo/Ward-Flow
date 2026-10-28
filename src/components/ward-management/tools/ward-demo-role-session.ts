"use client";

import { useSyncExternalStore } from "react";

import type { WardAccess } from "../ward-role-access";
import type { WardChromeRole } from "../ward-chrome-role";
import { setWardAccess } from "../shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "../shell/ward-feature-flag-store";
import { dispatchPersonaSyncForRole } from "../settings/persona-sync";

type DemoRoleSession = {
  readonly desk: WardAccess;
  readonly deviceFlag: boolean | null;
  readonly persona: WardChromeRole;
  readonly personaDeskId?: string;
};

// Memory only. Opening/closing the Demo menu and client-side role navigation must not lose
// the starting desk. Nothing here changes a scenario, account membership or shared permission.
let session: DemoRoleSession | null = null;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function publish() {
  for (const listener of listeners) listener();
}
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

export function useDemoRoleSession() {
  return useSyncExternalStore(
    subscribe,
    () => session,
    () => null,
  );
}

/** Called only by the local-synthetic component, after its shared/session gates. */
export function selectDemoRole(next: WardAccess, original: DemoRoleSession) {
  session ??= original;
  // In development this existing safeguard is initially off. Enable its real scoped view
  // for the demonstration; production's locked-on safeguard is never weakened.
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(next);
  syncPersona(
    next.role === "admin" ? "executive" : next.role,
    next.scope.kind === "ward" ? next.scope.unitIds[0] : next.scope.kind === "ed" ? next.scope.edId : undefined,
  );
  publish();
}

export function exitDemoRole(): WardAccess | null {
  if (!session) return null;
  const original = session;
  session = null;
  setWardAccess(original.desk);
  syncPersona(original.persona, original.personaDeskId);
  setWardFeatureFlagOnDevice("role-access", original.deviceFlag);
  publish();
  return original.desk;
}
