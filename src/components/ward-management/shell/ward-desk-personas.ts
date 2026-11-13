import { useContext } from "react";

import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { SIGNED_IN_COORDINATOR_NAME } from "@/components/ward-management/ward-staff-names-seed";

import { SharedSessionContext } from "./ward-shared-session-context";

export type DeskPersona = {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly role: string;
  /** How the tour greets them: the name without a title or post-nominal, a doctor keeping "Dr". */
  readonly greeting: string;
};

/**
 * B6 (Josh, 19 Oct 2026): one switcher. The person on the rail follows the desk ("Go to a desk"
 * sets both the person and the place), so there is no separate persona list to fall out of step
 * with the menu. Demo personas, synthetic. A desk with no drawn persona shows its role alone.
 * Kept apart from the rail so the tour reads the same people without loading the rail.
 */
/** The role line of a desk with no drawn persona in the public, browser-only demo. */
export const DEMO_DESK_ROLE = "Demo desk";

/** The same desk's role line on the shared signed-in site, where a real account works as the desk. */
export const SIGNED_IN_DESK_ROLE = "Signed in";

export const DESK_PERSONAS: Record<WardChromeRole, DeskPersona> = {
  // A15-06 (Audit 15, Josh 13 Nov 2026): an invented name from the one staff list, not a title, an
  // initial and a common surname that a clinician in the room could carry. The id stays "chen" so a
  // saved desk choice still finds this persona.
  coordinator: {
    id: "chen",
    name: SIGNED_IN_COORDINATOR_NAME,
    initials: "SO",
    role: "Bed coordinator",
    greeting: SIGNED_IN_COORDINATOR_NAME,
  },
  ed: {
    id: "gallagher",
    name: "Sr M. Gallagher",
    initials: "MG",
    role: "Triage liaison nurse",
    greeting: "M. Gallagher",
  },
  ward: { id: "vance", name: "K. Vance RN", initials: "KV", role: "Nurse in charge", greeting: "K. Vance" },
  officer: { id: "okafor", name: "A. Okafor", initials: "AO", role: "Transport officer", greeting: "A. Okafor" },
  community: { id: "hart", name: "L. Hart", initials: "LH", role: "Community team clinician", greeting: "L. Hart" },
  bed_manager: {
    id: "bed_manager",
    name: CHROME_ROLE_LABELS.bed_manager,
    initials: "BM",
    role: DEMO_DESK_ROLE,
    greeting: CHROME_ROLE_LABELS.bed_manager,
  },
  executive: {
    id: "executive",
    name: CHROME_ROLE_LABELS.executive,
    initials: "EX",
    role: DEMO_DESK_ROLE,
    greeting: CHROME_ROLE_LABELS.executive,
  },
};

/** An access admin gives roles and sees no patients, so it has no clinical persona (#790). */
export const ACCESS_ADMIN_PERSONA: DeskPersona = {
  id: "admin",
  name: "Access admin",
  initials: "AA",
  role: DEMO_DESK_ROLE,
  greeting: "Access admin",
};

/**
 * The shared signed-in site (a session in `SharedSessionContext`) is not the public demo, so a desk
 * with no drawn persona never reads "Demo desk" there: it keeps its role as its name and says
 * "Signed in". The public demo, with no session, is unchanged.
 */
function deskPersonaFor(persona: DeskPersona, signedIn: boolean): DeskPersona {
  return signedIn && persona.role === DEMO_DESK_ROLE ? { ...persona, role: SIGNED_IN_DESK_ROLE } : persona;
}

/** `deskPersonaFor` for the current session: signed in when the shared workspace supplies one. */
export function useDeskPersona(persona: DeskPersona): DeskPersona {
  return deskPersonaFor(persona, useContext(SharedSessionContext) !== null);
}
