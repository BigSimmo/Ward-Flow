import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";

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
export const DESK_PERSONAS: Record<WardChromeRole, DeskPersona> = {
  coordinator: { id: "chen", name: "Dr S. Chen", initials: "SC", role: "Bed coordinator", greeting: "Dr S. Chen" },
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
    role: "Demo desk",
    greeting: CHROME_ROLE_LABELS.bed_manager,
  },
  executive: {
    id: "executive",
    name: CHROME_ROLE_LABELS.executive,
    initials: "EX",
    role: "Demo desk",
    greeting: CHROME_ROLE_LABELS.executive,
  },
};
