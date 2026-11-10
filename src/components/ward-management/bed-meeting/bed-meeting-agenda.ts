import { durMinutes } from "@/components/wf";

import type { Admission } from "../ward-admissions";
import type { Instant } from "../ward-clock";
import type { BedRelease, Movement, Unit } from "../ward-model";
import { edById } from "../ward-sites";
import { outOfAreaLedger } from "../ward-referrals-out-of-area";
import { strandedFlags, strandedPromptText } from "../ward-stranded";
import { isWaitingInEd } from "../ward-ed-presence";
import { closedBedsPastReview } from "../capacity/bed-closure-review";
import type { BedMeetingAction, BedMeetingSubject } from "./bed-meeting-actions";

/**
 * BED MEETING AGENDA (smart features idea 5, 19 Oct 2026). Built from fixed rules over what is
 * already recorded, never typed: the longest ED waits, held beds soonest to run out, stranded
 * stays, people out of area, and the actions agreed last time. Read only.
 */
const DEFAULT_ITEMS_PER_SECTION = 5;

export type AgendaItem = {
  subject: BedMeetingSubject;
  record: Movement | Admission;
  /** The ward a ward-owned action would go to, if one is known. */
  unitId?: string;
  detail: string;
  /** The one figure the meeting reads first (the wait, the time left), shown at the row's end. */
  value?: string;
  /** A word under the figure saying what it counts ("waiting", "left"). */
  caption?: string;
};

export type AgendaSection = { id: string; title: string; total: number; items: AgendaItem[] };

export type MeetingActionRow = { subject: BedMeetingSubject; record: Movement | Admission; action: BedMeetingAction };

export type MeetingActionSummary = {
  /** Marked done in the last day. */
  doneLastDay: number;
  overdue: MeetingActionRow[];
  open: MeetingActionRow[];
};

function edLine(edId: string | undefined): string {
  const name = edById(edId)?.name;
  return name ? `In ${name.replace(/ Emergency Department$/, " ED")}` : "In ED";
}

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
  /** How many people each list keeps. The agenda page keeps everyone and folds with Show more. */
  limit: number = DEFAULT_ITEMS_PER_SECTION,
): AgendaSection[] {
  const { movements, admissions, bedReleases, units } = input;
  const open = movements.filter((movement) => !movement.closure && movement.stage !== "arrived");

  const edWaits = open
    .filter(isWaitingInEd)
    .sort((a, b) => a.openedAt - b.openedAt || a.id.localeCompare(b.id))
    .map((movement) => ({
      subject: movementSubject(movement),
      record: movement,
      ...(movement.acceptedUnitId !== undefined ? { unitId: movement.acceptedUnitId } : {}),
      // Polish (Josh, 3 Nov 2026): the wait is the row's figure, so the line names where they wait.
      detail: edLine(movement.originEdId),
      value: durMinutes(now - movement.openedAt),
      caption: "waiting",
    }));

  const holds = open
    // Every held bed, soonest to run out first: no invented cut-off decides which ones matter.
    .filter((movement) => movement.stage === "pulled" && movement.pullExpiresAt !== undefined)
    .sort((a, b) => a.pullExpiresAt! - b.pullExpiresAt! || a.id.localeCompare(b.id))
    .map((movement) => {
      const left = movement.pullExpiresAt! - now;
      return {
        subject: movementSubject(movement),
        record: movement,
        ...(movement.acceptedUnitId !== undefined ? { unitId: movement.acceptedUnitId } : {}),
        detail: left > 0 ? "Pulled bed" : `Pull expired ${durMinutes(-left)} ago`,
        value: left > 0 ? durMinutes(left) : "Expired",
        caption: left > 0 ? "left" : `${durMinutes(-left)} ago`,
      };
    });

  const admissionById = new Map(admissions.map((admission) => [admission.id, admission]));
  const stranded = strandedFlags(admissions, now, bedReleases).flatMap((flag) => {
    const admission = admissionById.get(flag.admissionId);
    if (!admission) return [];
    return [
      {
        subject: admissionSubject(admission),
        record: admission,
        unitId: admission.unitId,
        detail: strandedPromptText(flag),
        value: `${flag.days}d`,
        caption: "in hospital",
      },
    ];
  });

  const outOfArea = outOfAreaLedger([...admissions], [...units], now)
    .entries.sort((a, b) => b.sinceArrival - a.sinceArrival || a.admission.id.localeCompare(b.admission.id))
    .map((entry) => ({
      subject: admissionSubject(entry.admission),
      record: entry.admission,
      unitId: entry.admission.unitId,
      detail: entry.unit.name,
      value: durMinutes(entry.sinceArrival),
      caption: "away",
    }));

  return [
    { id: "ed-waits", title: "Longest ED waits", items: edWaits },
    { id: "holds", title: "Pulled beds, soonest to expire", items: holds },
    { id: "stranded", title: "Stranded stays", items: stranded },
    { id: "out-of-area", title: "Out of area", items: outOfArea },
  ].map((section) => ({
    ...section,
    total: section.items.length,
    items: section.items.slice(0, limit),
  }));
}

/** Item 6 (10 Nov 2026): one bed still closed whose review time has passed. A bed, not a person. */
export type ClosedBedReviewItem = {
  unitId: string;
  wardName: string;
  bedNumber: number;
  closedAt: Instant;
  reviewAt: Instant;
};

/**
 * Item 6: "Closed beds past review", its own small section kind, since an agenda item is about a
 * person (`AgendaItem.record`). Wards in the neutral service-then-name order. A prompt only: the
 * ward reopens a bed on its own page.
 */
export function closedBedsReviewSection(
  units: readonly Unit[],
  now: Instant,
): { id: "closed-beds-review"; title: string; total: number; items: ClosedBedReviewItem[] } {
  const items = closedBedsPastReview(units, now).map(({ unit, mark }) => ({
    unitId: unit.id,
    wardName: unit.name,
    bedNumber: mark.bedNumber,
    closedAt: mark.at,
    reviewAt: mark.reviewAt!,
  }));
  return { id: "closed-beds-review", title: "Closed beds past review", total: items.length, items };
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
