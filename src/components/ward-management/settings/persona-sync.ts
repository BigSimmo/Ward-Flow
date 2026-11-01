import { useSyncExternalStore } from "react";

import { useAccessShellRole } from "@/components/ward-management/shell/ward-access-store";
import { WARD_SHELL_ROLE, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";

import type { DeskRole } from "./workstation-desks";

/**
 * The persona sync event lives apart from the desk switcher, so a screen that only announces a
 * desk change (global search, the rail) does not pull the switcher's code into every page.
 */
export const WARD_PERSONA_SYNC_EVENT = "ward-flow-persona-sync";

/**
 * The desk "Go to a desk" last announced, kept in one place (overall review, 20 Oct 2026) so the
 * rail's person and the desk picker's "You are here" row read the same answer. The coordinator
 * until a desk is chosen; a desk opened by its link announces nothing, so the person stays.
 */
let personaRole: DeskRole = "coordinator";
/** The one desk chosen with that role, when a desk (not just a role) was chosen (PR #489 review). */
let personaDeskId: string | undefined;
/** The page that desk opened, so the menu's own-place link ("My ward") goes there (Q201). */
let personaDeskHref: string | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Announce the desk now in use. `deskId` names the one desk chosen ("Go to a desk"); a switch that
 * picks only a role (global search's desk commands) passes none, so no single desk counts as theirs.
 */
export function dispatchPersonaSyncForRole(role: DeskRole, deskId?: string, deskHref?: string) {
  if (typeof window === "undefined") return;
  personaRole = role;
  personaDeskId = deskId;
  personaDeskHref = deskHref;
  for (const listener of listeners) listener();
  window.dispatchEvent(new CustomEvent<{ role: DeskRole }>(WARD_PERSONA_SYNC_EVENT, { detail: { role } }));
}

/**
 * Whose role the shell is being used as. A non-coordinator desk (role access on) is its own role;
 * otherwise it is the desk last chosen in "Go to a desk", the coordinator until then. A page's
 * route never changes it: a coordinator who opens a ward or ED page by its link is still the
 * coordinator, viewing that desk.
 */
export function useShellPersonaRole(): WardChromeRole {
  const deskRole = useAccessShellRole(WARD_SHELL_ROLE);
  const synced = useSyncExternalStore(
    subscribe,
    () => personaRole,
    () => "coordinator" as const,
  );
  return deskRole === WARD_SHELL_ROLE ? synced : deskRole;
}

/** The desk last chosen in "Go to a desk", if one was; undefined after a role-only switch. */
export function usePersonaDeskId(): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => personaDeskId,
    () => undefined,
  );
}

/** The page the desk last chosen in "Go to a desk" opened, if one was announced. */
export function usePersonaDeskHref(): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => personaDeskHref,
    () => undefined,
  );
}
