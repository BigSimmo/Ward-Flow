import type { DeskRole } from "./workstation-desks";

/**
 * The persona sync event lives apart from the desk switcher, so a screen that only announces a
 * desk change (global search, the rail) does not pull the switcher's code into every page.
 */
export const WARD_PERSONA_SYNC_EVENT = "ward-flow-persona-sync";

export function dispatchPersonaSyncForRole(role: DeskRole) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<{ role: DeskRole }>(WARD_PERSONA_SYNC_EVENT, { detail: { role } }));
}
