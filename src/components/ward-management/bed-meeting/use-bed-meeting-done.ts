"use client";

import { useUndoableStep } from "../use-undoable-step";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import type { WardFlowRole } from "../ward-flow-events";
import { bedMeetingActionLabel, type BedMeetingActionKind, type BedMeetingSubject } from "./bed-meeting-actions";

export type MarkBedMeetingActionDone = (
  subject: BedMeetingSubject,
  action: BedMeetingActionKind,
  actingUnitId?: string,
) => void;

/**
 * H-0150: marks a bed meeting action done and offers Undo on the toast, under the usual step undo
 * rules (`UNDO_BED_MEETING_ACTION`). Call it in a component that stays on screen after the row
 * closes: a toast raised from an unmounted page is dropped.
 */
export function useBedMeetingDone(role: WardFlowRole): MarkBedMeetingActionDone {
  const { dispatch, rejections } = useWardFlowSelect("dispatch", "rejections");
  const now = useWardFlowClock();
  const { run } = useUndoableStep({ dispatch, rejections, now, routeRole: role });
  return (subject: BedMeetingSubject, action: BedMeetingActionKind, actingUnitId?: string) => {
    const unit = actingUnitId ? { actingUnitId } : {};
    const label = bedMeetingActionLabel(action);
    run(
      { type: "COMPLETE_BED_MEETING_ACTION", role, now, subject, action, ...unit },
      {
        success: `Marked done: ${label}.`,
        undo: (at) => ({ type: "UNDO_BED_MEETING_ACTION", role, now: at, subject, action, ...unit }),
        undone: `Undone. ${label} is open again.`,
      },
    );
  };
}
