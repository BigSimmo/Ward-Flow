import { CENSUS_GROUPS, type CensusGroup, type CensusRow } from "./patient-census";

/**
 * PS1 (Josh, 3 Nov 2026): Patients is the register of everyone Ward Flow holds, split by where each
 * person is now. The five states use the patient page's own state words (PT1), so a person reads
 * the same here as on their own page. Every row lands in exactly one state, read from its census
 * group, so the counts always add up to the register total.
 *
 * - In ED: waiting in an emergency department, with no ward asked yet or a ward still to answer.
 * - In placement: a bed found or pulled, on the way to it, or waiting from outside an ED.
 * - Inpatient: on a ward, including on leave or away at an ED with the bed kept.
 * - Community: nothing open, with a community team recorded.
 * - Not active: nothing open and no community team recorded.
 */
export type PatientState = "ed" | "placement" | "inpatient" | "community" | "off";

export type PatientStateFilter = "all" | PatientState;

export const PATIENT_STATES: readonly { id: PatientState; label: string }[] = [
  { id: "ed", label: "In ED" },
  { id: "placement", label: "In placement" },
  { id: "inpatient", label: "Inpatient" },
  { id: "community", label: "Community" },
  { id: "off", label: "Not active" },
];

/**
 * Waiting rows name an emergency department as "<site> ED". Everyone else waiting is being placed
 * from somewhere else: a community team's referral or a ward's own waiting list.
 */
function inAnEd(row: CensusRow): boolean {
  return row.where.endsWith(" ED") || row.where === "ED not recorded";
}

export function patientStateOf(row: CensusRow): PatientState {
  switch (row.group) {
    case "ask":
    case "wait":
      return inAnEd(row) ? "ed" : "placement";
    case "found":
    case "move":
      return "placement";
    case "ward":
      return "inpatient";
    case "off":
      return row.communityTeam !== null ? "community" : "off";
  }
}

export function countPatientStates(rows: readonly CensusRow[]): Record<PatientStateFilter, number> {
  const counts: Record<PatientStateFilter, number> = {
    all: rows.length,
    ed: 0,
    placement: 0,
    inpatient: 0,
    community: 0,
    off: 0,
  };
  for (const row of rows) counts[patientStateOf(row)] += 1;
  return counts;
}

/**
 * The register's sections. They follow the census groups, with two splits:
 * - Records with nothing open split in two, so the Community and Not active counts on the switch
 *   each match one section.
 * - M1 (Josh, 3 Nov 2026): people with no bed yet split by source, ED waits first, then those
 *   waiting from a community referral or a ward's waiting list. The list section only shows when
 *   it has someone in it.
 */
type CensusSectionKey = CensusGroup | "team" | "ask-list" | "wait-list";

const LIST_LABELS: Partial<Record<CensusGroup, { key: CensusSectionKey; label: string }>> = {
  ask: { key: "ask-list", label: "No ward asked yet, waiting list or referral" },
  wait: { key: "wait-list", label: "Ward asked, waiting list or referral" },
};

export type CensusSection = {
  key: CensusSectionKey;
  group: (typeof CENSUS_GROUPS)[number];
  label: string;
  rows: CensusRow[];
};

export function censusSections(rows: readonly CensusRow[]): CensusSection[] {
  return CENSUS_GROUPS.flatMap((group): CensusSection[] => {
    const inGroup = rows.filter((row) => row.group === group.id);
    const list = LIST_LABELS[group.id];
    if (list) {
      const fromList = inGroup.filter((row) => !inAnEd(row));
      const sections: CensusSection[] = [{ key: group.id, group, label: group.label, rows: inGroup.filter(inAnEd) }];
      if (fromList.length > 0) sections.push({ key: list.key, group, label: list.label, rows: fromList });
      return sections;
    }
    if (group.id !== "off") return [{ key: group.id, group, label: group.label, rows: inGroup }];
    return [
      {
        key: "team",
        group,
        label: "With a community team",
        rows: inGroup.filter((row) => row.communityTeam !== null),
      },
      { key: "off", group, label: group.label, rows: inGroup.filter((row) => row.communityTeam === null) },
    ];
  });
}
