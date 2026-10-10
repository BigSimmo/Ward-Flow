"use client";

import { useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { Siren, X } from "lucide-react";
import { Button, StatusGlyph } from "@/components/wf";
import { WardFlowContext, useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import type { Movement, Rejection } from "@/components/ward-management/ward-model";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { resolveAlertSubject } from "./alerts-model";
import { isAlertLive, replyBoard } from "./global-alert-view";
import {
  BROADCAST_ANSWER_LABELS,
  broadcastKind,
  isPullNowOverdue,
  type BroadcastAlert,
  type BroadcastReply,
} from "./ward-broadcast-model";
import styles from "./global-alerts.module.css";

function answerText(reply: BroadcastReply, now: Instant): string {
  const label = BROADCAST_ANSWER_LABELS[reply.answer];
  if (reply.beds !== undefined) return `${label} ${reply.beds}`;
  if (reply.readyAt !== undefined) return `${label} ${formatInstantWithDay(reply.readyAt, now)}`;
  if (reply.reason) return `${label}, ${DECLINE_REASON_LABELS[reply.reason].toLowerCase()}`;
  return label;
}

/** Who was asked and what each desk said, unanswered first. Chase is Preview until messaging exists. */
export function ReplyBoardList({
  alert,
  units,
  now,
}: {
  alert: BroadcastAlert;
  units: readonly { id: string; name: string }[];
  now: Instant;
}) {
  const board = replyBoard(alert, units);
  if (board.rows.length === 0) return null;
  const waiting = board.rows.length - board.answered;
  return (
    <section className={styles.board} aria-label="Replies">
      <div className={styles.boardHead}>
        <span className={styles.boardTitle}>Replies</span>
        <span className={styles.quiet}>
          {board.answered} of {board.rows.length} answered
          {broadcastKind(alert) === "bed_call" ? `, ${board.bedsOffered} beds offered` : ""}
        </span>
        <Button
          size="sm"
          className={styles.push}
          disabledReason="Not wired in this prototype."
          reasonDisplay="tooltip"
          count={waiting}
        >
          Chase
        </Button>
      </div>
      <ul className={styles.rows}>
        {board.rows.map((row) => (
          <li key={row.unitId} className={styles.row}>
            <StatusGlyph
              tone={row.reply ? (row.reply.answer === "cannot" ? "closed" : "success") : "neutral"}
              size={9}
            />
            <span className={styles.name}>{row.name}</span>
            <span className={row.reply ? styles.answer : styles.quiet}>
              {row.reply ? answerText(row.reply, now) : "Not answered"}
            </span>
            {row.reply ? <span className={styles.mono}>{formatInstantWithDay(row.reply.at, now)}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One live Pull now on the Alerts page: who, which ward, answer time, replies, stand down. */
export function PullNowCard({ alert, onStandDown }: { alert: BroadcastAlert; onStandDown: (id: string) => void }) {
  const { units, movements, patients, referrals } = useWardFlow();
  const now = useWardFlowClock();
  const movement = movements.find((m) => m.id === alert.movementId);
  const subject = resolveAlertSubject(movement, alert.movementId, { patients, referrals, movements }, units);
  const overdue = isPullNowOverdue(alert, now);
  return (
    <article
      className={styles.card}
      data-act-now={overdue ? "true" : undefined}
      aria-label={`Pull now, ${subject.displayName}`}
    >
      <div className={styles.cardHead}>
        <StatusGlyph tone={overdue ? "danger" : "neutral"} size={10} />
        <strong className={styles.cardTitle}>{subject.displayName}</strong>
        <span className={styles.mono}>{subject.umrn}</span>
        <span className={styles.quiet}>at {subject.from}</span>
        <Button size="sm" icon={X} className={styles.push} onClick={() => onStandDown(alert.id)}>
          Stand down
        </Button>
      </div>
      <p className={styles.quiet}>
        {overdue ? "No answer by " : "Answer by "}
        <span className={styles.mono}>
          {alert.answerBy !== undefined ? formatInstantWithDay(alert.answerBy, now) : ""}
        </span>
        , sent <span className={styles.mono}>{formatInstantWithDay(alert.dispatchedAt, now)}</span> to{" "}
        {alert.targetScopeLabel}
      </p>
      <ReplyBoardList alert={alert} units={units} now={now} />
    </article>
  );
}

/**
 * The coordinator's Pull now button for one waiting patient. Shows the live alert instead once one
 * is sent, and the engine's own words when it refuses.
 */
export function PullNowButton({ movement }: { movement: Movement }) {
  // Screens rendered outside the provider (isolated tests, previews) show no button.
  return useContext(WardFlowContext) ? <PullNowControl movement={movement} /> : null;
}

function PullNowControl({ movement }: { movement: Movement }) {
  const { broadcastAlerts, movements, dispatch, rejections } = useWardFlow();
  const now = useWardFlowClock();
  const [refusalFrom, setRefusalFrom] = useState<number | null>(null);
  // Greyed with a reason on any other desk, never hidden (role limits, PR #206).
  const isCoordinatorDesk = wardChromeRole(usePathname() ?? "") === "coordinator";
  const live = broadcastAlerts.find(
    (alert) =>
      broadcastKind(alert) === "pull_now" && alert.movementId === movement.id && isAlertLive(alert, movements, now),
  );
  const refusal =
    refusalFrom === null
      ? undefined
      : rejections
          .slice(refusalFrom)
          .find((r: Rejection) => r.attempted === "RAISE_PULL_NOW" && r.movementId === movement.id);
  if (live) {
    return (
      <span className={styles.sent}>
        <StatusGlyph tone={isPullNowOverdue(live, now) ? "danger" : "neutral"} size={9} />
        Pull now sent, answer by{" "}
        <span className={styles.mono}>
          {live.answerBy !== undefined ? formatInstantWithDay(live.answerBy, now) : ""}
        </span>
      </span>
    );
  }
  return (
    <>
      <Button
        size="sm"
        icon={Siren}
        aria-label="Pull now, ask the ward to pull this patient"
        disabledReason={isCoordinatorDesk ? undefined : "Only the bed coordinator sends Pull now"}
        reasonDisplay="tooltip"
        onClick={() => {
          if (!isCoordinatorDesk) return;
          setRefusalFrom(rejections.length);
          dispatch({ type: "RAISE_PULL_NOW", role: "coordinator", now, movementId: movement.id });
        }}
      >
        Pull now
      </Button>
      {refusal ? (
        <span className={styles.quiet} role="status">
          {refusal.reason.replace(/^RAISE_PULL_NOW /, "").replace(/^./, (c: string) => c.toUpperCase())}
        </span>
      ) : null}
    </>
  );
}
