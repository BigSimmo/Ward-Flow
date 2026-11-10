/**
 * Item 11 follow-up: absences without leave and transfers in a look's window, read from the times
 * the record already holds. Nothing is stored.
 *
 * - An absence: a held bed's `absentWithoutLeave.since` (when the ward recorded it). An absence
 *   that has ended is no longer on record (`END_LEAVE_BED` removes the held bed), so only open
 *   absences count.
 * - A transfer: a stay that left with a "transferred to" destination (`leftAt`), which is how
 *   both the ward's own departure and the coordinator's ward transfer arrival record it.
 *
 * Bed changes are not here: they need a picture saved at an earlier look (`since-last-look.ts`).
 */
import { LEAVING_DESTINATIONS, type Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { LeaveBed } from "@/components/ward-management/ward-model-leave";
import type { Unit } from "@/components/ward-management/ward-model";

export type NightMovementChange = {
  kind: "absence" | "transfer";
  admissionId: string;
  unitId: string;
  at: Instant;
  /** What happened, with a ward or destination but never a person. */
  text: string;
};

type NightMovementWorld = {
  admissions: readonly Pick<Admission, "id" | "unitId" | "state" | "leftAt" | "leavingDestination" | "careJourney">[];
  leaveBeds: readonly Pick<LeaveBed, "admissionId" | "unitId" | "absentWithoutLeave">[];
  units?: readonly Pick<Unit, "id" | "name">[];
};

/** Absences recorded and transfers out in `since` to `now`, oldest first. */
export function nightMovementChanges(world: NightMovementWorld, since: Instant, now: Instant): NightMovementChange[] {
  const within = (at: Instant | null | undefined) => at !== null && at !== undefined && at >= since && at <= now;
  const wardName = (unitId: string) => world.units?.find((unit) => unit.id === unitId)?.name ?? "Ward not recorded";
  const changes: NightMovementChange[] = [];
  for (const bed of world.leaveBeds) {
    const absence = bed.absentWithoutLeave;
    if (!absence || !within(absence.since)) continue;
    changes.push({
      kind: "absence",
      admissionId: bed.admissionId,
      unitId: bed.unitId,
      at: absence.since,
      text: `absent without leave from ${wardName(bed.unitId)}`,
    });
  }
  for (const admission of world.admissions) {
    const { leavingDestination: destination, leftAt } = admission;
    if (admission.state !== "departed" || !destination?.startsWith("transferred-") || leftAt === null) continue;
    if (!within(leftAt)) continue;
    const receiving = admission.careJourney?.transfer;
    const text =
      receiving?.step === "arrived" && receiving.receivingUnitId !== admission.unitId
        ? `moved from ${wardName(admission.unitId)} to ${wardName(receiving.receivingUnitId)}`
        : `${(LEAVING_DESTINATIONS.find((entry) => entry.id === destination)?.label ?? "Transferred").toLowerCase()}, from ${wardName(admission.unitId)}`;
    changes.push({ kind: "transfer", admissionId: admission.id, unitId: admission.unitId, at: leftAt, text });
  }
  return changes.sort((a, b) => a.at - b.at);
}
