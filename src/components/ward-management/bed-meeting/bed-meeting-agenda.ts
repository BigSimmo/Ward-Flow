import { durMinutes } from "@/components/wf";

import type { Admission } from "../ward-admissions";
import type { Instant } from "../ward-clock";
import type { BedRelease, Movement, Unit } from "../ward-model";
import { outOfAreaLedger } from "../ward-referrals-out-of-area";
import { strandedFlags, strandedPromptText } from "../ward-stranded";
import type { BedMeetingAction, BedMeetingSubject } from "./bed-meeting-actions";

/**
 * BED MEETING AGENDA (smart features idea 5, 19 Oct 2026). Built from fixed rules over what is
 * already recorded, never typed: the longest ED waits, held beds soonest to run out, stranded
 * stays, people out of area, and the actions agreed last time. Read only.
 */
export const AGENDA_ITEMS_PER_SECTION = 5;

const STILL_IN_ED = new Set<Movement["stage"]>(["placement_requested", "destination_review", "accepted_awaiting_bed"]);

export type AgendaItem = {
  subject: BedMeetingSubject;
  record: Movement | Admission;
  /** The ward a ward-owned action would go to, if one is known. */
  unitId?: string;
  detail: string;
};

export type AgendaSection = { id: string; title: string; items: AgendaItem[] };

export type MeetingActionRow = { subject: BedMeetingSubject; record: Movement | Admission; action: BedMeetingAction };

export type MeetingActionSummary = {
  /** Marked done in the last day. */
  doneLastDay: number;
  overdue: MeetingActionRow[];
  open: MeetingActionRow[];
};

const movementSubject = (movement: Movement): BedMeetingSubject => ({ kind: "movement", id: movement.id });
const admissionSubject = (admission: Admission): BedMeetingSubject => ({ kind: "admission", id: admission.id });

export function bedMeetingAgenda(
  input: {
    movements: readonly Movement[];
    admissions: readonly Admission[];
    bedReleases: readonly BedRelease[];
    units: readonly Unit[];
  },
  now: Instant,
): AgendaSection[] {
  const { movements, admissions, bedReleases, units } = input;
  const open = movements.filter((movement) => !movement.closure && movement.stage !== "arrived");

  const edWaits = open
    .filter((movement) => STILL_IN_ED.has(movement.stage) && movement.leftDepartmentAt === undefined)
    .sort((a, b) => a.openedAt - b.openedAt || a.id.localeCompare(b.id))
    .slice(0, AGENDA_ITEMS_PER_SECTION)
    .map((movement) => ({
      subject: movementSubject(movement),
      record: movement,
      ...(movement.acceptedUnitId !== undefined ? { unitId: movement.acceptedUnitId } : {}),
      detail: `Waiting ${durMinutes(now - movement.openedAt)} in ED`,
    }));

  const holds = open
    // Every held bed, soonest to run out first: no invented cut-off decides which ones matter.
    .filter((movement) => movement.stage === "pulled" && movement.pullExpiresAt !== undefined)
    .sort((a, b) => a.pullExpiresAt! - b.pullExpiresAt! || a.id.localeCompare(b.id))
    .slice(0, AGENDA_ITEMS_PER_SECTION)
    .map((movement) => {
      const left = movement.pullExpiresAt! - now;
      return {
        subject: movementSubject(movement),
        record: movement,
        ...(movement.acceptedUnitId !== undefined ? { unitId: movement.acceptedUnitId } : {}),
        detail: left > 0 ? `Hold runs out in ${durMinutes(left)}` : `Hold ran out ${durMinutes(-left)} ago`,
      };
    });

  const admissionById = new Map(admissions.map((admission) => [admission.id, admission]));
  const stranded = strandedFlags(admissions, now, bedReleases)
    .slice(0, AGENDA_ITEMS_PER_SECTION)
    .flatMap((flag) => {
      const admission = admissionById.get(flag.admissionId);
      if (!admission) return [];
      return [
        {
          subject: admissionSubject(admission),
          record: admission,
          unitId: admission.unitId,
          detail: `${flag.days} days · ${strandedPromptText(flag)}`,
        },
      ];
    });

  const outOfArea = outOfAreaLedger([...admissions], [...units], now)
    .entries.sort((a, b) => b.sinceArrival - a.sinceArrival || a.admission.id.localeCompare(b.admission.id))
    .slice(0, AGENDA_ITEMS_PER_SECTION)
    .map((entry) => ({
      subject: admissionSubject(entry.admission),
      record: entry.admission,
      unitId: entry.admission.unitId,
      detail: `${entry.unit.name} · in for ${durMinutes(entry.sinceArrival)}`,
    }));

  return [
    { id: "ed-waits", title: "Longest ED waits", items: edWaits },
    { id: "holds", title: "Held beds, soonest to run out", items: holds },
    { id: "stranded", title: "Stranded stays", items: stranded },
    { id: "out-of-area", title: "Out of area", items: outOfArea },
  ];
}

/** Every recorded action, where it stands now. Overdue is shown, never escalated. */
export function meetingActionSummary(
  movements: readonly Movement[],
  admissions: readonly Admission[],
  now: Instant,
): MeetingActionSummary {
  const rows: MeetingActionRow[] = [
    ...movements.flatMap((record) =>
      (record.meetingActions ?? []).map((action) => ({ subject: movementSubject(record), record, action })),
    ),
    ...admissions.flatMap((record) =>
      (record.meetingActions ?? []).map((action) => ({ subject: admissionSubject(record), record, action })),
    ),
  ];
  const notDone = rows.filter((row) => row.action.doneAt === undefined).sort((a, b) => a.action.dueAt - b.action.dueAt);
  return {
    doneLastDay: rows.filter((row) => row.action.doneAt !== undefined && now - row.action.doneAt <= 24 * 60).length,
    overdue: notDone.filter((row) => row.action.dueAt < now),
    open: notDone.filter((row) => row.action.dueAt >= now),
  };
}
