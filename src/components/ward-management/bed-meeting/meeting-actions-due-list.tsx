"use client";

import { useCallback, useRef } from "react";

import { Button, Card, CardBody, CardHead, StatusGlyph } from "@/components/wf";

import { formatInstantWithDay, type Instant } from "../ward-clock";
import { useWardFlowClock } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import {
  bedMeetingActionLabel,
  type BedMeetingAction,
  type BedMeetingActionOwner,
  type BedMeetingSubject,
} from "./bed-meeting-actions";
import styles from "./meeting-actions-due.module.css";

/**
 * The open bed meeting actions `MeetingActionsDue` found for this desk, each with a Mark done
 * button. Loaded on its own, only when there is one to show, so the patient page's first load stays
 * in its phone script budget (#511).
 */
export function DueActions({
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
  // A double click must close one action only: the list shifts up as one closes, so a second click
  // would land on the next action (Audit 7 NB-02). One Mark done per short pause.
  const lastDoneAt = useRef(Number.NEGATIVE_INFINITY);
  const claimDone = useCallback(() => {
    const at = performance.now();
    if (at - lastDoneAt.current < DONE_PAUSE_MS) return false;
    lastDoneAt.current = at;
    return true;
  }, []);
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
                onClick={(event) => {
                  // The second click of a double click is never a fresh Mark done.
                  if (event.detail > 1 || !claimDone()) return;
                  raise("COMPLETE_BED_MEETING_ACTION", {
                    subject,
                    action: action.kind,
                    ...(desk === "ward" ? { actingUnitId: action.ownerUnitId } : {}),
                  });
                }}
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

/** How long after one Mark done the card ignores another, longer than a double click. */
const DONE_PAUSE_MS = 1000;

/** The agenda's wording: shown when overdue, never escalated. */
function dueWords(dueAt: Instant, now: Instant): string {
  return `${dueAt < now ? "Was due" : "Due"} ${formatInstantWithDay(dueAt, now)}`;
}
