import { isOpen } from "@/components/ward-management/ward-derivations";
import { S2015_CATCHMENT_ROWS, parseFollowUpClinicSet } from "@/components/ward-management/ward-catchment";
import type { Movement } from "@/components/ward-management/ward-model";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import type { HubEntry } from "./hub-derivations";

/** One person a place's panel names: their name, and their page when a record links them. */
export type PlacePerson = { key: string; name: string; href?: string };

/**
 * Who the Places panel names for one place (PL1 follow-up, Josh, 4 Nov 2026: names, not counts).
 * A ward lists the open movements it has accepted, so the people heading there. An ED lists the open
 * movements that began there and have not been collected yet, so the people still waiting there.
 * A team holds no movements, so it lists nobody. Longest wait first, read off each movement's own
 * opening time, so the list never borrows another page's numbers.
 */
export function placePeople(
  entry: Pick<HubEntry, "id" | "kind">,
  movements: readonly Movement[],
  resolve: (movement: Movement) => ResolvedPatientInfo,
): PlacePerson[] {
  if (entry.kind === "community") return [];
  const here = movements.filter((movement) => {
    if (!isOpen(movement)) return false;
    if (entry.kind === "ward") return movement.acceptedUnitId === entry.id;
    return movement.originEdId === entry.id && movement.transport?.collectedAt === undefined;
  });
  return [...here]
    .sort((left, right) => left.openedAt - right.openedAt || left.id.localeCompare(right.id))
    .map((movement) => {
      const info = resolve(movement);
      const id = info.patient?.id;
      return { key: movement.id, name: info.formalName, ...(id === undefined ? {} : { href: patientHref(id) }) };
    });
}

/** The fold `communityTeamSuburbCounts` keys teams by: case, whitespace and punctuation. */
function teamKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

/**
 * The suburbs the catchment table routes to one team, alphabetically, for the Places panel (PL1
 * follow-up, Josh, 4 Nov 2026: the suburbs a team covers, as names). Kept here, with the only
 * screen that reads it, so the Ward page's shared bundle does not carry it.
 */
export function communityTeamSuburbs(teamName: string): readonly string[] {
  const key = teamKey(teamName);
  if (key === "") return [];
  const suburbs = new Set<string>();
  for (const row of S2015_CATCHMENT_ROWS) {
    if (parseFollowUpClinicSet(row.followUpClinicVerbatim).some((clinic) => teamKey(clinic) === key)) {
      suburbs.add(row.suburb);
    }
  }
  return [...suburbs].sort((left, right) => left.localeCompare(right));
}
