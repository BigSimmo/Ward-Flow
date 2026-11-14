"use client";

import { useRef } from "react";
import { Button, StatusGlyph } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { openMeetingAction } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { useBedMeetingRecord } from "@/components/ward-management/bed-meeting/use-bed-meeting-done";

import {
  SILENT_WARD_ANOTHER_WARD_SUGGESTION,
  SILENT_WARD_SECOND_REMINDER_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { movementOfferNoReplyWaits, noReplyTimeLabel, type NoReplyWait } from "./referral-no-reply";
import styles from "./referral-no-reply-timers.module.css";

/**
 * REFERRAL RESPONSE TIMER (Josh, 9 Nov 2026). "1h 20m left" before the referral answer limit set in
 * Settings, "Overdue 40m" after it. A highlight beside the ward's name: it moves no row, ranks
 * nothing and escalates nothing by itself. Only the coordinator's own tap on Escalate records an
 * escalation, as a bed meeting action for that ward (`escalate_ward_answer`), with Undo on the toast.
 */
export function NoReplyTimer({ wait, testId }: { wait: NoReplyWait; testId?: string }) {
  return (
    <span className={styles.timer} data-overdue={wait.pastLimit || undefined} data-testid={testId}>
      {wait.pastLimit ? <StatusGlyph tone="danger" size={8} /> : null}
      {noReplyTimeLabel(wait)}
      <span className="sr-only">{` for an answer from ${wait.place}`}</span>
    </span>
  );
}

/** The movement's per-ward waits, or none outside a provider. */
function useMovementOfferWaits(movement: Movement | undefined, now: Instant): NoReplyWait[] {
  const flow = useOptionalWardFlowSelect("configuration", "units");
  if (!flow || !movement) return [];
  return movementOfferNoReplyWaits(movement, now, flow.configuration, flow.units);
}

/**
 * One tap for the coordinator once a ward's answer is overdue. Once recorded it reads
 * "Escalated · due 10:30" until the action is done. Call only inside the Ward Flow provider.
 */
export function EscalateNoReply({
  movement,
  wait,
  now,
  personName,
}: {
  movement: Movement;
  /** The first overdue ward; absent once every ward has answered (the escalation still shows). */
  wait: NoReplyWait | undefined;
  now: Instant;
  personName: string;
}) {
  const record = useBedMeetingRecord("coordinator");
  const focusAfter = useRef(false);
  // An escalation belongs to the ward it was raised for: once that ward answers, the next overdue
  // ward offers its own Escalate rather than showing the earlier ward's.
  const open = movement.meetingActions?.find(
    (action) =>
      action.kind === "escalate_ward_answer" &&
      action.doneAt === undefined &&
      (wait?.unitId === undefined || action.ownerUnitId === undefined || action.ownerUnitId === wait.unitId),
  );
  if (open)
    return (
      <span
        className={styles.escalated}
        data-testid={`ward-offer-escalated-${movement.id}`}
        tabIndex={-1}
        ref={(node) => {
          if (node && focusAfter.current) {
            focusAfter.current = false;
            node.focus();
          }
        }}
      >
        Escalated · due {formatInstantWithDay(open.dueAt, now)}
      </span>
    );
  if (!wait?.pastLimit || wait.unitId === undefined) return null;
  const unitId = wait.unitId;
  return (
    <Button
      variant="sec"
      size="sm"
      aria-label={`Escalate ${wait.place}'s answer for ${personName}`}
      data-testid={`ward-offer-escalate-${movement.id}`}
      onClick={() => {
        focusAfter.current = true;
        record({
          subject: { kind: "movement", id: movement.id },
          action: "escalate_ward_answer",
          owner: "ward",
          unitId,
          dueAt: now + 60,
          success: `Escalated ${wait.place}.`,
        });
      }}
    >
      Escalate
    </Button>
  );
}

/**
 * The status card's lines: one per ward still to answer, with its timer, and Escalate for the
 * coordinator once overdue. Nothing when no ward is waiting.
 */
export function NoReplyTimerList({
  movement,
  now,
  canEscalate,
  personName,
}: {
  movement: Movement;
  now: Instant;
  canEscalate: boolean;
  personName: string;
}) {
  const waits = useMovementOfferWaits(movement, now);
  if (waits.length === 0) {
    // Every ward has answered, but a recorded escalation stays in view until it is marked done.
    if (!canEscalate || !openMeetingAction(movement.meetingActions, "escalate_ward_answer")) return null;
    return (
      <ul className={styles.list} aria-label="Ward answers" data-testid="ward-patient-answer-timers">
        <li className={styles.row}>
          <span className={styles.head}>Ward answer</span>
          <span className={styles.push}>
            <EscalateNoReply movement={movement} wait={undefined} now={now} personName={personName} />
          </span>
        </li>
      </ul>
    );
  }
  const firstOverdue = waits.find((wait) => wait.pastLimit);
  return (
    <ul className={styles.list} aria-label="Ward answers" data-testid="ward-patient-answer-timers">
      <li className={styles.row}>
        <span className={styles.head}>Ward answer</span>
      </li>
      {waits.map((wait) => (
        <li key={wait.unitId ?? wait.place} className={styles.row}>
          <span className={styles.place}>{wait.place}</span>
          <NoReplyTimer wait={wait} testId={`ward-patient-answer-timer-${wait.unitId ?? wait.place}`} />
          {canEscalate && wait === firstOverdue ? (
            <span className={styles.push}>
              <EscalateNoReply movement={movement} wait={wait} now={now} personName={personName} />
            </span>
          ) : null}
        </li>
      ))}
      {waits.some((wait) => wait.waitedMinutes >= SILENT_WARD_SECOND_REMINDER_MINUTES) ? (
        <li className={styles.row} data-testid="ward-patient-answer-another-ward">
          {SILENT_WARD_ANOTHER_WARD_SUGGESTION}
        </li>
      ) : null}
    </ul>
  );
}
