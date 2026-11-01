"use client";

import dynamic from "next/dynamic";

import { useIsBreakGlassRecord } from "../shell/ward-access";
import { useEffectiveWardAccess, useWardAccessSnapshot } from "../shell/ward-access-store";
import { useWardFlowSelect } from "../ward-flow-provider";
import type { WardAccess } from "../ward-role-access";
import type { BedMeetingAction, BedMeetingActionOwner, BedMeetingSubject } from "./bed-meeting-actions";
import { useBedMeetingDone } from "./use-bed-meeting-done";

const DueActions = dynamic(() => import("./meeting-actions-due-list").then((m) => m.DueActions));

/**
 * Overall review, 20 Oct 2026: the owner of a bed meeting action had no way to mark it done; only
 * the coordinator's agenda had the button. This lists the open actions on one bed request or stay
 * that belong to the viewer's desk, each with a Mark done button. The coordinator sees every open
 * action; a ward desk only its own wards' actions; the ED and community desks only theirs. A site
 * bed manager sees none: Q97 (Josh, 1 Nov 2026) keeps Done with the owner or the chair. Nothing
 * shows when there is none. Nothing shows either
 * while the coordinator previews another desk, or on a record this desk sees only through break
 * glass (the scope layer's own set, so a grant on a patient already in scope hides nothing). Both
 * are read only, so the button could never record anything (review on PR #511). Marking one done
 * changes nothing else on the record.
 */
export function MeetingActionsDue({ subject }: { subject: BedMeetingSubject | undefined }) {
  const access = useEffectiveWardAccess();
  const { previewOf } = useWardAccessSnapshot();
  const isBreakGlass = useIsBreakGlassRecord();
  const { movements, admissions } = useWardFlowSelect("movements", "admissions");
  // H-0150: held here, not in the list, so the toast's Undo outlives the row and the card it closes.
  const desk = deskRole(access);
  // A desk that owns no action never shows the list, so the fallback role is never used.
  const markActionDone = useBedMeetingDone(desk ?? "coordinator");
  if (!subject || previewOf !== null) return null;
  const record =
    subject.kind === "movement"
      ? movements.find((movement) => movement.id === subject.id)
      : admissions.find((admission) => admission.id === subject.id);
  if (!desk) return null;
  // The scope layer's own read-only set: patients this desk sees only through break glass.
  if (isBreakGlass(record)) return null;
  const due = (record?.meetingActions ?? []).filter(
    (action) => action.doneAt === undefined && deskOwnsAction(access, desk, action),
  );
  if (due.length === 0) return null;
  return <DueActions subject={subject} desk={desk} actions={due} onMarkDone={markActionDone} />;
}

/** The owner role this desk acts as, or none for a desk that never owns an action. */
function deskRole(access: WardAccess): BedMeetingActionOwner | undefined {
  const { role } = access;
  return role === "coordinator" || role === "ward" || role === "ed" || role === "community" ? role : undefined;
}

/** The same test the reducer applies to a completion, so the button is never one it would refuse. */
function deskOwnsAction(access: WardAccess, desk: BedMeetingActionOwner, action: BedMeetingAction): boolean {
  if (desk === "coordinator") return true;
  if (action.owner !== desk) return false;
  if (desk !== "ward") return true;
  return (
    access.scope.kind === "ward" &&
    action.ownerUnitId !== undefined &&
    access.scope.unitIds.includes(action.ownerUnitId)
  );
}
