import type { BedMeetingActionKind, BedMeetingSubject } from "./bed-meeting/bed-meeting-actions";
import type { Instant } from "./ward-clock";
import type { WardFlowRole } from "./ward-flow-roles";

/**
 * Takes back the newest `COMPLETE_BED_MEETING_ACTION` of this kind on this record (H-0150). It lives
 * beside `ward-flow-events.ts` so the event union stays under its line cap.
 */
export type UndoBedMeetingActionEvent = {
  type: "UNDO_BED_MEETING_ACTION";
  role: WardFlowRole;
  now: Instant;
  /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
  recordSeq?: number;
  subject: BedMeetingSubject;
  action: BedMeetingActionKind;
  actingUnitId?: string;
};
