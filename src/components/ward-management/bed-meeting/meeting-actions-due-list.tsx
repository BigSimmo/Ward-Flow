"use client";

import { useCallback, useRef } from "react";

import { Button, Card, CardBody, CardHead, StatusGlyph } from "@/components/wf";

import { formatInstantWithDay, type Instant } from "../ward-clock";
import { useWardFlowClock } from "../ward-flow-provider";
import { useRefocusAfterRowLeaves } from "../use-refocus-after-row-leaves";
import { DONE_PAUSE_MS } from "../ward-operational-defaults";
import {
  bedMeetingActionLabel,
  type BedMeetingAction,
  type BedMeetingActionOwner,
  type BedMeetingSubject,
} from "./bed-meeting-actions";
import styles from "./meeting-actions-due.module.css";
import type { MarkBedMeetingActionDone } from "./use-bed-meeting-done";

/**
 * The open bed meeting actions `MeetingActionsDue` found for this desk, each with a Mark done
 * button. Loaded on its own, only when there is one to show, so the patient page's first load stays
 * in its phone script budget (#511).
 */
export function DueActions({
  subject,
  desk,
  actions,
  onMarkDone,
}: {
  subject: BedMeetingSubject;
  desk: BedMeetingActionOwner;
  actions: readonly BedMeetingAction[];
  onMarkDone: MarkBedMeetingActionDone;
}) {
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
  // RB-N01: the closed action's row leaves with it; focus goes to the Mark done now in its place.
  const list = useRef<HTMLUListElement>(null);
  const markDone = useRefocusAfterRowLeaves({
    list,
    selector: '[data-testid="meeting-action-mark-done"]',
    rowsKey: actions.map((action) => action.kind).join("|"),
  });
  return (
    <Card data-testid="meeting-actions-due">
      <CardHead title="Agreed at the bed meeting" meta={`${actions.length}`} level={2} />
      <CardBody>
        <ul className={styles.list} ref={list}>
          {actions.map((action, index) => (
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
                  markDone(index);
                  onMarkDone(subject, action.kind, desk === "ward" ? action.ownerUnitId : undefined);
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

/** The agenda's wording: shown when overdue, never escalated. */
function dueWords(dueAt: Instant, now: Instant): string {
  return `${dueAt < now ? "Was due" : "Due"} ${formatInstantWithDay(dueAt, now)}`;
}
