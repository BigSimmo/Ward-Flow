"use client";

// The broadcast banner's body, split out of `ward-broadcast-banner.tsx` (20 October 2026) so the
// shared shell's first load carries only the cheap "is there a live alert for this desk" check.
// It is server-rendered and preloaded when idle, so a live alert paints as before.

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { Button, StatusGlyph, buttonClass, durMinutes, useIsPhone, type WfTone } from "@/components/wf";
import type { WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";
import {
  BED_CALL_MAX_BEDS,
  BROADCAST_ANSWER_LABELS,
  DEFAULT_BROADCAST_EXTENSION_MINUTES,
  READY_IN_CHOICES,
  broadcastKind,
  deskHasAnswered,
  formatTimeRemaining,
  latestReplies,
  type BroadcastAlert,
  type BroadcastAnswer,
  type BroadcastReply,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import {
  deskName,
  directiveAcknowledgements,
  replyBoard,
  type BannerEntry,
  type BannerTone,
} from "@/components/ward-management/alerts/global-alert-view";
import { resolveAlertSubject } from "@/components/ward-management/alerts/alerts-model";
import { useDeskInScope } from "@/components/ward-management/shell/ward-access";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  REFERRAL_DECLINE_REASONS,
  type ReferralDeclineReason,
  type Unit,
} from "@/components/ward-management/ward-model";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import styles from "./ward-broadcast-banner.module.css";

const TONE_GLYPH: Record<BannerTone, WfTone> = {
  act_now: "danger",
  critical: "danger",
  warning: "warning",
  advisory: "info",
  waiting: "neutral",
};

function kindLabel(alert: BroadcastAlert): string {
  const kind = broadcastKind(alert);
  if (kind === "pull_now") return "Pull now";
  if (kind === "bed_call") return "Bed call";
  return alert.severity === "critical"
    ? "Critical directive"
    : alert.severity === "warning"
      ? "Operational advisory"
      : "Network notice";
}

function answerText(reply: BroadcastReply, now: Instant): string {
  const label = BROADCAST_ANSWER_LABELS[reply.answer];
  if (reply.beds !== undefined) return `${label} ${reply.beds}`;
  if (reply.readyAt !== undefined) return `${label} ${formatInstantWithDay(reply.readyAt, now)}`;
  if (reply.reason) return `${label}, ${DECLINE_REASON_LABELS[reply.reason].toLowerCase()}`;
  return label;
}

type Lookup = Parameters<typeof resolveAlertSubject>[2];

export function BannerBody({
  entry,
  more,
  desk,
  now,
  units,
  lookup,
  onDispatch,
  lifecycle,
}: {
  /** Top 25 item 25 (flagged): extend or stand down this alert, when this desk may. */
  lifecycle?: { extend?: () => void; standDown?: () => void };
  entry: BannerEntry;
  more: number;
  desk: { role: string; id: string | null };
  now: Instant;
  units: readonly Unit[];
  lookup: Lookup;
  onDispatch: WardFlowContextValue["dispatch"];
}) {
  const { alert, tone, needsAnswer } = entry;
  const kind = broadcastKind(alert);
  const [choosing, setChoosing] = useState<BroadcastAnswer | null>(null);
  const [changing, setChanging] = useState(false);
  const isPhone = useIsPhone();
  const deskInScope = useDeskInScope();
  const isRed = tone === "act_now";
  // D-80: on one of its wards' pages a site bed manager answers for that ward in its own name.
  const bedManager = useRouteRole() === "bed_manager";
  const actingRole =
    desk.role === "coordinator" ? "coordinator" : desk.role === "ed" ? "ed" : bedManager ? "bed_manager" : "ward";

  const reply = (
    answer: BroadcastAnswer,
    extra: { beds?: number; readyAt?: Instant; reason?: ReferralDeclineReason },
  ) => {
    if (!desk.id) return;
    onDispatch({
      type: "REPLY_BROADCAST_ALERT",
      role: actingRole,
      now,
      alertId: alert.id,
      unitId: desk.id,
      answer,
      ...extra,
    });
    setChoosing(null);
    setChanging(false);
  };

  const acknowledge = () => {
    if (!desk.id) return;
    onDispatch({ type: "ACKNOWLEDGE_BROADCAST_ALERT", role: actingRole, now, alertId: alert.id, unitId: desk.id });
  };

  const movement = alert.movementId ? lookup.movements?.find((m) => m.id === alert.movementId) : undefined;
  const fullSubject = kind === "pull_now" ? resolveAlertSubject(movement, alert.movementId, lookup, units) : undefined;
  // Names in full on the TV too, as on every screen (Josh, 26 Oct 2026; CT-03's initials undone).
  const subject = fullSubject;
  const myReply = desk.id ? latestReplies(alert).get(desk.id) : undefined;
  const board = kind === "directive" ? undefined : replyBoard(alert, units);
  const directiveAcks = kind === "directive" ? directiveAcknowledgements(alert, units, deskInScope) : undefined;
  // A desk that holds none of the asked desks (a community team, the jobs desk) shows no count, not "0 of 0".
  const acks = directiveAcks && (directiveAcks.of > 0 || !deskInScope) ? directiveAcks : undefined;
  const showAnswers = (needsAnswer || changing) && kind !== "directive";
  const headline = subject ? subject.displayName : alert.title;
  const countText = board
    ? `${board.answered} of ${board.rows.length} answered`
    : acks
      ? `${acks.acknowledged} of ${acks.of} acknowledged`
      : null;

  /*
   * Phone (ops-10, 13 Oct 2026): one line, glyph, kind, title and the answered count, that opens
   * Alerts. The answer buttons follow only for a desk that must answer, so the coordinator and an
   * answered desk keep most of the screen for the page beneath.
   */
  if (isPhone) {
    return (
      <section
        className={styles.banner}
        data-tone={tone}
        data-kind={kind}
        data-severity={alert.severity}
        data-layout="phone-line"
        data-testid="ward-broadcast-banner"
        role={isRed || alert.severity === "critical" ? "alert" : "status"}
        aria-live={isRed ? "assertive" : "polite"}
        aria-atomic="true"
        aria-label={`${kindLabel(alert)}: ${headline}`}
      >
        <span className="sr-only">These counts are invented figures.</span>
        <Link href={WARD_ALERTS_HREF} className={styles.phoneLine}>
          <StatusGlyph tone={TONE_GLYPH[tone]} size={12} />
          <span className={styles.kind}>{kindLabel(alert)}</span>
          <strong className={styles.headline}>{headline}</strong>
          {countText ? <span className={styles.count}>{countText}</span> : null}
          {more > 0 ? <span className={styles.count}>{more} more</span> : null}
          <span className="sr-only">, open Alerts</span>
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
        {kind === "directive" && desk.id && needsAnswer ? (
          <div className={styles.answers}>
            <Button size="sm" icon={Check} onClick={acknowledge} title="Acknowledge this directive for your desk">
              Acknowledge
            </Button>
          </div>
        ) : null}
        {showAnswers ? (
          <AnswerRow kind={kind} choosing={choosing} setChoosing={setChoosing} reply={reply} now={now} />
        ) : null}
      </section>
    );
  }

  return (
    <section
      className={styles.banner}
      data-tone={tone}
      data-kind={kind}
      data-severity={alert.severity}
      data-testid="ward-broadcast-banner"
      role={isRed || alert.severity === "critical" ? "alert" : "status"}
      aria-live={isRed ? "assertive" : "polite"}
      aria-atomic="true"
      aria-label={`${kindLabel(alert)}: ${subject ? subject.displayName : alert.title}`}
    >
      {/* Counts below are announced; this sentence travels with them
          (tests/ward-announced-figures-carry-their-marker, tier b). Screen readers only. */}
      <span className="sr-only">These counts are invented figures.</span>
      <div className={styles.row}>
        <div className={styles.lead}>
          <StatusGlyph tone={TONE_GLYPH[tone]} size={12} />
          <span className={styles.kind}>{kindLabel(alert)}</span>
          {subject ? (
            <>
              <strong className={styles.headline}>{subject.displayName}</strong>
              {subject.umrn ? <span className={styles.mono}>{subject.umrn}</span> : null}
              <span className={styles.meta}>at {subject.from}</span>
              {movement ? (
                <span className={styles.meta}>
                  waiting <span className={styles.mono}>{durMinutes(Math.max(0, now - movement.openedAt))}</span>
                </span>
              ) : null}
            </>
          ) : (
            <>
              <strong className={styles.headline}>{alert.title}</strong>
              <span className={styles.meta}>{alert.targetScopeLabel}</span>
            </>
          )}
        </div>

        <div className={styles.actions}>
          {kind === "pull_now" && alert.answerBy !== undefined ? (
            <span className={styles.meta}>
              {desk.role === "coordinator" ? `To ${alert.targetScopeLabel}, answer by ` : "Answer by "}
              <span className={styles.mono}>{formatInstantWithDay(alert.answerBy, now)}</span>
            </span>
          ) : (
            <span className={styles.meta} title="Time until this alert ends">
              <span className={styles.mono}>{formatTimeRemaining(alert.expiresAt, now)}</span>
            </span>
          )}

          {board ? (
            <span className={styles.count}>
              {board.answered} of {board.rows.length} answered
              {kind === "bed_call" ? `, ${board.bedsOffered} beds offered` : ""}
            </span>
          ) : acks ? (
            <span className={styles.count} title={`${acks.acknowledged} units confirmed receipt`}>
              {acks.acknowledged} of {acks.of} acknowledged
            </span>
          ) : null}

          {kind === "directive" && desk.id ? (
            needsAnswer ? (
              <Button size="sm" icon={Check} onClick={acknowledge} title="Acknowledge this directive for your desk">
                Acknowledge
              </Button>
            ) : deskHasAnswered(alert, desk.id) ? (
              <span className={styles.done}>
                <StatusGlyph tone="success" size={10} />
                Acknowledged
              </span>
            ) : null
          ) : null}

          {myReply && !changing ? (
            <span className={styles.done}>
              <StatusGlyph tone="success" size={10} />
              You said: {answerText(myReply, now)}
              <button type="button" className={styles.linkButton} onClick={() => setChanging(true)}>
                Change
              </button>
            </span>
          ) : null}

          {kind === "pull_now" && subject?.patientHref && desk.role !== "coordinator" ? (
            <Link href={subject.patientHref} className={buttonClass({ size: "sm" })}>
              Open patient
            </Link>
          ) : null}

          {lifecycle?.extend ? (
            <Button size="sm" onClick={lifecycle.extend} data-testid="ward-broadcast-extend">
              Extend {durMinutes(DEFAULT_BROADCAST_EXTENSION_MINUTES)}
            </Button>
          ) : null}
          {lifecycle?.standDown ? (
            <Button size="sm" variant="ghost" onClick={lifecycle.standDown} data-testid="ward-broadcast-stand-down">
              Stand down
            </Button>
          ) : null}

          <Link href={WARD_ALERTS_HREF} className={buttonClass({ size: "sm", variant: "ghost" })}>
            {more > 0 ? `Alerts, ${more} more` : "Alerts"}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {kind !== "pull_now" ? <p className={styles.message}>{alert.message}</p> : null}

      {showAnswers ? (
        <AnswerRow kind={kind} choosing={choosing} setChoosing={setChoosing} reply={reply} now={now} />
      ) : null}

      {kind === "pull_now" && desk.role === "coordinator" && board ? (
        <p className={styles.message}>
          {board.rows
            .map((row) => `${deskName(row.unitId, units)}: ${row.reply ? answerText(row.reply, now) : "not answered"}`)
            .join(". ")}
          .
        </p>
      ) : null}
    </section>
  );
}

function AnswerRow({
  kind,
  choosing,
  setChoosing,
  reply,
  now,
}: {
  kind: "bed_call" | "pull_now" | "directive";
  choosing: BroadcastAnswer | null;
  setChoosing: (answer: BroadcastAnswer | null) => void;
  reply: (answer: BroadcastAnswer, extra: { beds?: number; readyAt?: Instant; reason?: ReferralDeclineReason }) => void;
  now: Instant;
}) {
  if (choosing === "can_take") {
    return (
      <div className={styles.answers} role="group" aria-label="How many beds can you take">
        <span className={styles.meta}>Beds</span>
        {Array.from({ length: BED_CALL_MAX_BEDS }, (_, i) => i + 1).map((beds) => (
          <Button key={beds} size="sm" onClick={() => reply("can_take", { beds })}>
            {beds}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setChoosing(null)}>
          Back
        </Button>
      </div>
    );
  }
  if (choosing === "after_discharge" || choosing === "bed_ready_at") {
    return (
      <div className={styles.answers} role="group" aria-label="When will a bed be ready">
        <span className={styles.meta}>Ready at</span>
        {READY_IN_CHOICES.map((minutes) => {
          const readyAt = (now + minutes) as Instant;
          return (
            <Button key={minutes} size="sm" onClick={() => reply(choosing, { readyAt })}>
              <span className={styles.mono}>{formatInstantWithDay(readyAt, now)}</span>
            </Button>
          );
        })}
        <Button size="sm" variant="ghost" onClick={() => setChoosing(null)}>
          Back
        </Button>
      </div>
    );
  }
  if (choosing === "cannot" && kind === "pull_now") {
    return (
      <div className={`${styles.answers} ${styles.reasons}`} role="group" aria-label="Why the ward can't pull now">
        <span className={styles.meta}>Reason</span>
        {REFERRAL_DECLINE_REASONS.map((reason) => (
          <Button key={reason} size="sm" onClick={() => reply("cannot", { reason })}>
            {DECLINE_REASON_LABELS[reason]}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setChoosing(null)}>
          Back
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.answers} role="group" aria-label="Your answer">
      {kind === "pull_now" ? (
        <>
          <Button size="sm" variant="pri" onClick={() => reply("pulling_now", {})}>
            Pulling now
          </Button>
          <Button size="sm" onClick={() => setChoosing("bed_ready_at")}>
            Bed ready at
          </Button>
          <Button size="sm" onClick={() => setChoosing("cannot")}>
            Can&apos;t
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="pri" onClick={() => setChoosing("can_take")}>
            Can take
          </Button>
          <Button size="sm" onClick={() => setChoosing("after_discharge")}>
            After a discharge
          </Button>
          <Button size="sm" onClick={() => reply("cannot", {})}>
            Can&apos;t
          </Button>
        </>
      )}
    </div>
  );
}
