import type { Movement } from "./ward-model";
import { createReadmissionIndex, movementReadmissionFlag, type ReadmissionRecords } from "./ward-readmission";

/**
 * The 28 day readmission flag on a ward's own copy (D-80, Josh's yes on 23 Oct 2026, changing his
 * 9 Oct ruling): once a ward has accepted a person, it is told the person was discharged from a
 * psychiatric ward inside the window. Its copy holds no other ward's stays, so the scoped workspace
 * works the flag out from the whole workspace and carries only the discharge time on the ward's own
 * accepted journeys. Never the other ward, the stay or anything else from that record.
 */
export function withWardReadmission(
  movements: Movement[],
  whole: ReadmissionRecords,
  unitIn: (unitId: string) => boolean,
): Movement[] {
  let index: ReturnType<typeof createReadmissionIndex> | undefined;
  return movements.map((movement) => {
    if (movement.acceptedUnitId === undefined || !unitIn(movement.acceptedUnitId)) {
      if (movement.readmissionDischargedAt === undefined) return movement;
      const notOwn = { ...movement };
      delete notOwn.readmissionDischargedAt;
      return notOwn;
    }
    // The browser scopes the server's ward copy again, with no other ward's stays left to read, so
    // a copy keeps what the first pass found.
    if (movement.readmissionDischargedAt !== undefined) return movement;
    index ??= createReadmissionIndex(whole);
    const flag = movementReadmissionFlag(movement, index);
    return flag ? { ...movement, readmissionDischargedAt: flag.dischargedAt } : movement;
  });
}

/** The flag a ward's copy carries, in the shape the flag chip reads, or null when it carries none. */
export function wardCopyReadmission(movement: Movement): { dischargedAt: number; daysBefore: number } | null {
  const dischargedAt = movement.readmissionDischargedAt;
  if (dischargedAt === undefined) return null;
  return { dischargedAt, daysBefore: Math.max(0, Math.floor((movement.openedAt - dischargedAt) / (24 * 60))) };
}
