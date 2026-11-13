"use client";

import type { WardAccess } from "../ward-role-access";
import type { WardChromeRole } from "../ward-chrome-role";
import { setWardAccess } from "../shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "../shell/ward-feature-flag-store";
import { dispatchPersonaSyncForRole } from "../settings/persona-sync";
import { onWardDemoReset } from "../ward-browser-data";
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

/**
 * F-65 (unverified point checked 13 Nov 2026): the session is memory only, so after a reload "Back to
 * Bed coordinator" and Reset demo could not put the role access setting back, and it stayed on. The
 * setting as it was before the first demo desk is kept for the tab, so either can restore it.
 */
const FLAG_BEFORE_KEY = "wardflow:demo-role-flag-before";

function rememberFlagBefore(deviceFlag: boolean | null) {
  try {
    if (window.sessionStorage.getItem(FLAG_BEFORE_KEY) === null)
      window.sessionStorage.setItem(FLAG_BEFORE_KEY, JSON.stringify(deviceFlag));
  } catch {
    // Storage blocked: the memory-only session still restores it until a reload.
  }
}

/**
 * Puts the role access setting back as it was before the first demo desk in this tab. The kept value
 * wins over `fallback` (the session's), which after a reload already holds the demo's own "on".
 */
function restoreFlagBefore(fallback?: boolean | null) {
  let before: boolean | null | undefined = fallback;
  try {
    const raw = window.sessionStorage.getItem(FLAG_BEFORE_KEY);
    window.sessionStorage.removeItem(FLAG_BEFORE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed === "boolean") before = parsed;
    }
  } catch {
    // Nothing kept, or storage blocked: the session's value stands.
  }
  if (before !== undefined) setWardFeatureFlagOnDevice("role-access", before);
}

/** "Back to Bed coordinator" after a reload, when the memory-only session is gone (F-65). */
export function restoreDemoRoleFlagAfterReload() {
  if (currentDemoRoleSession()) return;
  restoreFlagBefore();
}

onWardDemoReset(({ desk }) => {
  if (!desk) return;
  const original = currentDemoRoleSession();
  writeDemoRoleSession(null);
  restoreFlagBefore(original?.deviceFlag);
  publishDemoRoleSession();
});

/** Called only by the local-synthetic component, after its shared/session gates. */
export function selectDemoRole(next: WardAccess, original: DemoRoleSession) {
  const session = currentDemoRoleSession() ?? original;
  writeDemoRoleSession(session);
  rememberFlagBefore(session.deviceFlag);
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
  restoreFlagBefore(original.deviceFlag);
  publishDemoRoleSession();
  return desk;
}
