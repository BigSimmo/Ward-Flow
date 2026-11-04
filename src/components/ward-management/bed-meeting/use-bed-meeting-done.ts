"use client";

import { useUndoableStep } from "../use-undoable-step";
import { wardRaise } from "../ward-flow-raise";
import type { WardCommandDispatch } from "../ward-shared-client";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import type { WardFlowRole } from "../ward-flow-events";
import type { Instant } from "../ward-clock";
import {
  bedMeetingActionLabel,
  type BedMeetingActionKind,
  type BedMeetingActionOwner,
  type BedMeetingSubject,
} from "./bed-meeting-actions";

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

export type RecordBedMeetingAction = (step: {
  subject: BedMeetingSubject;
  action: BedMeetingActionKind;
  owner: BedMeetingActionOwner;
  unitId?: string;
  dueAt: Instant;
  /** The toast's title once the engine accepts the step. Defaults to "Recorded: <action>." */
  success?: string;
}) => ReturnType<WardCommandDispatch>;

/**
 * Chase Undo (Josh, 3 Nov 2026): records a bed meeting action and offers Undo on the toast, so a
 * Chase or a Record tapped by mistake is taken back under the usual step undo rules
 * (`UNDO_BED_MEETING_ACTION`). Like `useBedMeetingDone`, call it in a component that stays on
 * screen after the control that raised it goes.
 */
export function useBedMeetingRecord(role: WardFlowRole): RecordBedMeetingAction {
  const { dispatch, rejections } = useWardFlowSelect("dispatch", "rejections");
  const now = useWardFlowClock();
  const { runRecorded } = useUndoableStep({ dispatch, rejections, now, routeRole: role });
  return ({ subject, action, owner, unitId, dueAt, success }) => {
    const label = bedMeetingActionLabel(action);
    // runRecorded calls `record` at once: the form that asked waits on this same command's outcome.
    let completion: ReturnType<WardCommandDispatch> = undefined;
    runRecorded(
      () =>
        (completion = wardRaise(
          dispatch,
          role,
          now,
        )("RECORD_BED_MEETING_ACTION", {
          subject,
          action,
          owner,
          ...(unitId !== undefined ? { unitId } : {}),
          dueAt,
        })),
      {
        success: success ?? `Recorded: ${label}.`,
        undo: (at) => ({ type: "UNDO_BED_MEETING_ACTION", role, now: at, subject, action }),
        undone: `Undone. ${label} is taken back.`,
      },
    );
    return completion;
  };
}
