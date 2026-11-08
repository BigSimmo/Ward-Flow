// The patient search page's pure parts: the wait bands, the Show facets and the row tests and
// presence the page and its sections share. Moved out of `patient-search.tsx` for the line cap.
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { isOpen, type PatientSearchResult } from "@/components/ward-management/ward-derivations";
import { type Patient } from "@/components/ward-management/ward-patients";
import { LONG_WAIT_MINUTES, WAIT_FILTER_SHORT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { referralState } from "@/components/ward-management/ward-referrals";
import { CENSUS_HIGHLIGHTS, type CensusGroup, type CensusHighlight, type CensusRow } from "./patient-census";
import { isCommunityReferral } from "./community-referral";
import { waitedHours } from "./search-filters";

/** The wait bands, in hours, from Josh's named defaults (D-22, D-24): under 6, 6 to 24, over 24. */
export const SHORT_WAIT_HOURS = WAIT_FILTER_SHORT_MINUTES / 60;
export const LONG_WAIT_HOURS = LONG_WAIT_MINUTES / 60;

export const ACCESS_RECORD_EMPTY = "No searches this session.";

export type ShowFacetKey = "all" | "accepted" | "waiting" | "unowned" | "under6" | "6to24" | "over24";

export type ShowFacet = {
  key: ShowFacetKey;
  label: string;
  empty: string;
  test: (movement: Movement, now: number) => boolean;
};

export { waitedHours };

export const SHOW_FACETS: readonly ShowFacet[] = [
  { key: "all", label: "Everything", empty: "", test: () => true },
  {
    key: "accepted",
    label: "Accepted",
    empty: "No open movement here has an accepted ward.",
    test: (movement) => Boolean(movement.acceptedUnitId),
  },
  {
    key: "waiting",
    label: "No ward yet",
    empty: "Every open movement here has an accepted ward.",
    test: (movement) => !movement.acceptedUnitId,
  },
  {
    key: "unowned",
    label: "No owner",
    empty: "Every open movement here has an owner.",
    test: (movement) => !movement.owner,
  },
  {
    key: "under6",
    label: `Under ${SHORT_WAIT_HOURS} hours`,
    empty: `No open movement here has waited under ${SHORT_WAIT_HOURS} hours.`,
    test: (movement, now) => waitedHours(movement, now) < SHORT_WAIT_HOURS,
  },
  {
    key: "6to24",
    label: `${SHORT_WAIT_HOURS} to ${LONG_WAIT_HOURS} hours`,
    empty: `No open movement here has waited ${SHORT_WAIT_HOURS} to ${LONG_WAIT_HOURS} hours.`,
    test: (movement, now) => {
      const hours = waitedHours(movement, now);
      return hours >= SHORT_WAIT_HOURS && hours < LONG_WAIT_HOURS;
    },
  },
  {
    key: "over24",
    label: `Over ${LONG_WAIT_HOURS} hours`,
    empty: `No open movement here has waited over ${LONG_WAIT_HOURS} hours.`,
    test: (movement, now) => waitedHours(movement, now) >= LONG_WAIT_HOURS,
  },
];

export function highlightTest(highlight: CensusHighlight | null): (row: CensusRow) => boolean {
  const chip = CENSUS_HIGHLIGHTS.find((entry) => entry.id === highlight);
  return chip ? chip.test : () => false;
}

export function countGroups(rows: readonly CensusRow[]): Record<CensusGroup, number> {
  const counts: Record<CensusGroup, number> = { ask: 0, wait: 0, found: 0, move: 0, ward: 0, off: 0 };
  for (const row of rows) counts[row.group] += 1;
  return counts;
}

export function resultId(result: PatientSearchResult): string {
  return result.kind === "movement" ? result.movement.id : result.referral.id;
}

/** The Tier select holds "Tier 1" to "Tier 3", the same words each row shows. */
export function matchesTier(result: PatientSearchResult, tier: string): boolean {
  const urgency = result.kind === "movement" ? result.movement.urgency : result.referral.urgency;
  return `Tier ${urgency}` === tier;
}

function matchesPatient(item: unknown, patientId: string): boolean {
  if (typeof item === "object" && item !== null) {
    return Reflect.get(item, "patientId") === patientId;
  }
  return false;
}

export function getPatientPresence(
  patient: Patient,
  referrals: readonly Referral[],
  movements: readonly Movement[],
): { key: "live" | "community" | "scheduled" | "past"; label: string } {
  const movement = movements.find((m) => matchesPatient(m, patient.id) && isOpen(m));
  if (movement) return { key: "live", label: "On this board" };
  const referral = referrals.find((r) => matchesPatient(r, patient.id) && referralState(r) === "queued");
  if (referral) {
    // The same community test the rows use, so a community referral sent without its location is
    // still "Community / Home" here (source "community"), not "On this board".
    if (isCommunityReferral(referral)) {
      return { key: "community", label: "Community / Home" };
    }
    return { key: "live", label: "On this board" };
  }
  return { key: "past", label: "Past / Discharged" };
}
