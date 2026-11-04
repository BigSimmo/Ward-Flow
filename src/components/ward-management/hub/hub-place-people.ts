import { isOpen } from "@/components/ward-management/ward-derivations";
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
