"use client";

import { Button, Card, CardBody, CardHead, StatusGlyph } from "@/components/wf";

import { useEffectiveWardAccess, useWardAccessSnapshot } from "../shell/ward-access-store";
import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import type { WardAccess } from "../ward-role-access";
import {
  bedMeetingActionLabel,
  type BedMeetingAction,
  type BedMeetingActionOwner,
  type BedMeetingSubject,
} from "./bed-meeting-actions";
import styles from "./meeting-actions-due.module.css";

/**
 * Overall review, 20 Oct 2026: the owner of a bed meeting action had no way to mark it done; only
 * the coordinator's agenda had the button. This lists the open actions on one bed request or stay
 * that belong to the viewer's desk, each with a Mark done button. The coordinator sees every open
 * action; a ward desk only its own wards' actions; the ED and community desks only theirs. Nothing
 * shows when there is none, or while the `bed-meeting-actions` switch is off. Nothing shows either
 * while the coordinator previews another desk, or on a record this desk sees only through break
 * glass: both are read only, so the button could never record anything (review on PR #511).
 * Marking one done changes nothing else on the record.
 */
export function MeetingActionsDue({ subject }: { subject: BedMeetingSubject | undefined }) {
  const enabled = useWardFeatureFlag("bed-meeting-actions");
  const access = useEffectiveWardAccess();
  const { records, previewOf } = useWardAccessSnapshot();
  const { movements, admissions } = useWardFlowSelect("movements", "admissions");
  const now = useWardFlowClock();
  if (!enabled || !subject || previewOf !== null) return null;
  const record =
    subject.kind === "movement"
      ? movements.find((movement) => movement.id === subject.id)
      : admissions.find((admission) => admission.id === subject.id);
  const desk = deskRole(access);
  if (!desk) return null;
  const patientId = record?.patientId;
  const readOnlyGlass = records.some(
    (grant) => grant.role === access.role && grant.until > now && grant.patientId === patientId,
  );
  if (readOnlyGlass) return null;
  const due = (record?.meetingActions ?? []).filter(
    (action) => action.doneAt === undefined && deskOwnsAction(access, desk, action),
  );
  if (due.length === 0) return null;
  return <DueActions subject={subject} desk={desk} actions={due} />;
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

function DueActions({
  subject,
  desk,
  actions,
}: {
  subject: BedMeetingSubject;
  desk: BedMeetingActionOwner;
  actions: readonly BedMeetingAction[];
}) {
  const raise = useWardRaise(desk);
  const now = useWardFlowClock();
  return (
    <Card data-testid="meeting-actions-due">
      <CardHead title="Agreed at the bed meeting" meta={`${actions.length}`} level={2} />
      <CardBody>
        <ul className={styles.list}>
          {actions.map((action) => (
            <li key={action.kind} className={styles.row}>
              <div className={styles.rowText}>
                <span className={styles.name}>
                  <StatusGlyph tone={action.dueAt < now ? "warning" : "info"} size={8} />{" "}
                  {bedMeetingActionLabel(action.kind)}
                </span>
                <span className={styles.detail}>{dueWords(action.dueAt, now)}</span>
              </div>
              <Button
                size="sm"
                variant="sec"
                onClick={() =>
                  raise("COMPLETE_BED_MEETING_ACTION", {
                    subject,
                    action: action.kind,
                    ...(desk === "ward" ? { actingUnitId: action.ownerUnitId } : {}),
                  })
                }
                aria-label={`Mark done: ${bedMeetingActionLabel(action.kind)}`}
                data-testid="meeting-action-mark-done"
              >
                Mark done
              </Button>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

/** The agenda's wording: shown when overdue, never escalated. */
function dueWords(dueAt: Instant, now: Instant): string {
  return `${dueAt < now ? "Was due" : "Due"} ${formatInstantWithDay(dueAt, now)}`;
}
