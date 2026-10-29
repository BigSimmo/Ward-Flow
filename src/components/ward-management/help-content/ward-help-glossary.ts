import type { GlossaryTerm } from "../help/ward-help-content";
import { SAVE_NOT_CONFIRMED } from "../ward-save-failure";

export const GLOSSARY_GROUPS = [
  "Beds",
  "A patient's journey",
  "Records and forms",
  "People, services and short forms",
  "Screens, figures and urgency",
  "Save problems",
] as const;
export type GlossaryGroup = (typeof GLOSSARY_GROUPS)[number];
const GROUP_TERMS: readonly (readonly string[])[] = [
  [
    "Pulled",
    "Pull expired",
    "Held bed",
    "Pull time limit",
    "Being made ready",
    "Ready",
    "Confirmed beds",
    "Cohort",
    "Secure bed",
    "Short",
  ],
  [
    "Movement",
    "Referred",
    "Review",
    "Accepted",
    "Handover ready",
    "Moving",
    "Arrived",
    "Held up",
    "Past date",
    "Confirmed out",
    "CLD",
    "CLD ready",
    "Fit to travel",
    "Out of area",
    "EDD",
    "ETA",
  ],
  ["Tentative diagnosis", "Legal form", "UMRN", "CAD number", "Constant observation"],
  [
    "Catchment",
    "AWOL",
    "CTO",
    "MDT",
    "MHA",
    "ATS",
    "RAMP",
    "PSP",
    "MHAS",
    "GP",
    "BPSD",
    "ED",
    "ECT",
    "NIC",
    "NUM",
    "CAHS",
    "EMHS",
    "NMHS",
    "SMHS",
    "WACHS",
    "CAMHS",
    "HDU",
    "MHERL",
  ],
  [
    "Act now",
    "Tier",
    "T1",
    "T2",
    "T3",
    "Overdue waits",
    "Access target",
    "Board time",
    "Shift brief",
    "Notices",
    "Activity",
    "Synthetic",
    "Demo",
    "AWST",
    "KPI",
    "PIR",
  ],
];
export const SAVE_HELP_TERMS: readonly GlossaryTerm[] = [
  { term: "Save is not confirmed.", meaning: SAVE_NOT_CONFIRMED },
  { term: "Nothing was saved.", meaning: "The change definitely did not reach the board." },
];
export const CONFUSABLE_TERMS = [
  ["Held bed", "Pulled", "Held up"],
  ["Accepted", "Pulled"],
  ["Ready", "Being made ready"],
] as const;

/** Unknown directory codes are people/services; definitions still come from the supplied public directory. */
export function glossaryGroup(term: string): GlossaryGroup {
  if (term.startsWith("Form ")) return "Records and forms";
  if (SAVE_HELP_TERMS.some((entry) => entry.term === term)) return "Save problems";
  const index = GROUP_TERMS.findIndex((terms) => terms.includes(term));
  return index < 0 ? "People, services and short forms" : GLOSSARY_GROUPS[index];
}
export function relatedTerms(term: string): readonly string[] {
  return [...new Set(CONFUSABLE_TERMS.filter((terms) => (terms as readonly string[]).includes(term)).flat())].filter(
    (other) => other !== term,
  );
}
