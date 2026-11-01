"use client";

// The Broadcast tab's cards (Alerts redesign, 1 Nov 2026, BUILD-SPEC "Broadcast tab"): each live
// broadcast as a card with its answers or acknowledgements, an action bar along the bottom, the
// earlier broadcasts and an empty state. Built from the approved mock-up (`bcPanel()`, `earlier()`).
import { Clock, Copy, Radio, Users } from "lucide-react";

import { Button, durMinutes } from "@/components/wf";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";

import { minutesText } from "./alerts-model";
import { replyBoard } from "./global-alert-view";
import {
  DEFAULT_BROADCAST_EXTENSION_MINUTES,
  broadcastKind,
  type BroadcastAlert,
  type BroadcastReply,
} from "./ward-broadcast-model";
import css from "./broadcast-tab.module.css";

type Answer = "take" | "after" | "cant" | "none";
const ANSWERS: Record<Answer, { label: string; tone?: "success" | "accent" }> = {
  take: { label: "Can take", tone: "success" },
  after: { label: "After a discharge", tone: "accent" },
  cant: { label: "Can't" },
  none: { label: "No answer yet" },
};
const SEVERITY: Record<BroadcastAlert["severity"], { label: string; tone?: "warning" | "danger" }> = {
  advisory: { label: "Advisory" },
  warning: { label: "Warning", tone: "warning" },
  critical: { label: "Critical", tone: "danger" },
};

const answerOf = (reply: BroadcastReply | undefined): Answer =>
  !reply ? "none" : reply.answer === "can_take" ? "take" : reply.answer === "after_discharge" ? "after" : "cant";
const detailOf = (reply: BroadcastReply | undefined) =>
  reply?.beds !== undefined
    ? `${reply.beds} ${reply.beds === 1 ? "bed" : "beds"}`
    : reply?.readyAt !== undefined
      ? `Ready at ${formatInstant(reply.readyAt)}`
      : "";

/** A stacked bar and its key: what each answer counts, or who has acknowledged. */
function AnswerStack({
  counts,
  keys,
  done,
  of,
  verb,
}: {
  counts: Partial<Record<Answer, number>>;
  keys: { answer: Answer; label: string }[];
  done: number;
  of: number;
  verb: string;
}) {
  const label = keys.map(({ answer, label: name }) => `${counts[answer] ?? 0} ${name.toLowerCase()}`).join(", ");
  return (
    <>
      <div className={css.stack} role="img" aria-label={label}>
        {keys.map(({ answer }) =>
          counts[answer] ? <i key={answer} data-a={answer} style={{ flex: counts[answer] }} /> : null,
        )}
      </div>
      <div className={css.stackKey}>
        {keys.map(({ answer, label: name }) => (
          <span key={answer}>
            <i className={css.sw} data-a={answer} aria-hidden="true" />
            {name} <b>{counts[answer] ?? 0}</b>
          </span>
        ))}
        <span className={css.keyTotal}>
          {done} of {of} {verb}
        </span>
      </div>
    </>
  );
}

export function BroadcastLiveCard({
  alert,
  units,
  now,
  sentByYou,
  acknowledgements,
  onExtend,
  onCopyAnswers,
  onStandDown,
}: {
  alert: BroadcastAlert;
  units: readonly { id: string; name: string }[];
  now: Instant;
  sentByYou: boolean;
  /** A directive's acknowledgements against the desks this desk can see; undefined shows none. */
  acknowledgements: { acknowledged: number; of: number } | undefined;
  onExtend: () => void;
  onCopyAnswers: (text: string) => void;
  onStandDown: () => void;
}) {
  const bedCall = broadcastKind(alert) === "bed_call";
  const board = bedCall ? replyBoard(alert, units) : undefined;
  const severity = SEVERITY[alert.severity];
  const asked = board ? board.rows.length : (acknowledgements?.of ?? 0);
  const counts: Partial<Record<Answer, number>> = {};
  for (const row of board?.rows ?? []) {
    const answer = answerOf(row.reply);
    counts[answer] = (counts[answer] ?? 0) + 1;
  }
  const copyText = board
    ? [
        alert.title,
        ...board.rows.map((row) => `${row.name}: ${ANSWERS[answerOf(row.reply)].label} ${detailOf(row.reply)}`.trim()),
      ].join("\n")
    : "";
  return (
    <article
      className={css.card}
      data-severity={alert.severity}
      aria-live="assertive"
      aria-atomic="true"
      aria-label="Current broadcast"
    >
      {/* The counts below are announced; this sentence travels with them
          (tests/ward-announced-figures-carry-their-marker, tier b). Screen readers only. */}
      <span className="sr-only">These counts are invented figures.</span>
      <div className={css.head}>
        <span className={css.livePulse} aria-hidden="true" />
        <strong>Live</strong>
        <span className={css.tag} data-tone={severity.tone}>
          {severity.label}
        </span>
        <span className={css.tag}>{bedCall ? "Bed call" : "Message"}</span>
        <span>
          {alert.targetScopeLabel}
          {asked > 0 ? ` (${asked})` : ""} · sent {formatInstant(alert.dispatchedAt)} by{" "}
          {sentByYou ? "you" : alert.dispatchedByName}
        </span>
        <span className={css.left}>
          <b>{minutesText(Math.max(0, alert.expiresAt - now))}</b> left, ends {formatInstant(alert.expiresAt)}
        </span>
      </div>
      <div className={css.body}>
        <h3>{alert.title}</h3>
        <p>{alert.message}</p>
        {board ? (
          <>
            <AnswerStack
              counts={counts}
              keys={(["take", "after", "cant", "none"] as const).map((answer) => ({
                answer,
                label: ANSWERS[answer].label,
              }))}
              done={board.answered}
              of={board.rows.length}
              verb="answered"
            />
            <table className={css.table}>
              <thead>
                <tr>
                  <th scope="col">Ward</th>
                  <th scope="col">Answer</th>
                  <th scope="col">Detail</th>
                  <th scope="col">Answered</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.map((row) => {
                  const answer = answerOf(row.reply);
                  return (
                    <tr key={row.unitId}>
                      <td>{row.name}</td>
                      <td>
                        {answer === "none" ? (
                          <span className={css.dim}>No answer yet</span>
                        ) : (
                          <span className={css.tag} data-tone={ANSWERS[answer].tone}>
                            {ANSWERS[answer].label}
                          </span>
                        )}
                      </td>
                      <td>{detailOf(row.reply)}</td>
                      <td className={css.mono}>{row.reply ? formatInstant(row.reply.at) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : acknowledgements ? (
          <AnswerStack
            counts={{
              take: acknowledgements.acknowledged,
              none: acknowledgements.of - acknowledgements.acknowledged,
            }}
            keys={[
              { answer: "take", label: "Acknowledged" },
              { answer: "none", label: "Not acknowledged yet" },
            ]}
            done={acknowledgements.acknowledged}
            of={acknowledgements.of}
            verb="acknowledged"
          />
        ) : null}
      </div>
      <div className={css.foot}>
        <Button icon={Clock} onClick={onExtend}>
          Extend {durMinutes(DEFAULT_BROADCAST_EXTENSION_MINUTES)}
        </Button>
        <Button
          icon={Users}
          disabledReason="Adding units to a live broadcast is not built yet."
          reasonDisplay="tooltip"
        >
          Add units
        </Button>
        {board ? (
          <Button variant="ghost" icon={Copy} onClick={() => onCopyAnswers(copyText)}>
            Copy answers
          </Button>
        ) : null}
        <span className={css.spacer} />
        <Button aria-label="Stand down this alert" onClick={onStandDown}>
          Stand down
        </Button>
      </div>
    </article>
  );
}

/** Stood-down and ended broadcasts, newest first. */
export function EarlierBroadcasts({
  alerts,
  units,
  status,
}: {
  alerts: readonly BroadcastAlert[];
  units: readonly { id: string; name: string }[];
  status: (alert: BroadcastAlert) => string;
}) {
  if (alerts.length === 0) return null;
  return (
    <section aria-label="Earlier broadcasts">
      <h3 className={css.secHead}>
        Earlier today <span className={css.count}>{alerts.length}</span>
      </h3>
      <ul className={css.plain}>
        {alerts.map((alert) => {
          const board = broadcastKind(alert) === "bed_call" ? replyBoard(alert, units) : undefined;
          const tally = board
            ? `${board.answered} of ${board.rows.length} answered`
            : alert.acknowledgedUnits.length > 0
              ? `${alert.acknowledgedUnits.length} acknowledged`
              : "";
          return (
            <li key={alert.id}>
              <time>{formatInstant(alert.dispatchedAt)}</time>
              <span className={css.iconTile} aria-hidden="true">
                <Radio size={14} aria-hidden="true" />
              </span>
              <span className={css.pl}>
                <strong>{alert.title}</strong>
                <span>
                  {[SEVERITY[alert.severity].label, alert.targetScopeLabel, status(alert), tally]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Nothing live: say so, and offer the composer when this desk may broadcast. */
export function NoBroadcastLive({
  onCompose,
  composeDisabledReason,
}: {
  onCompose: (trigger: HTMLButtonElement) => void;
  composeDisabledReason: string | undefined;
}) {
  return (
    <div className={css.empty}>
      <span className={css.iconTile} data-size="lg" aria-hidden="true">
        <Radio size={20} aria-hidden="true" />
      </span>
      <strong>No broadcast live</strong>
      <span>A broadcast reaches every ward and ED desk you choose, and shows who has answered.</span>
      <Button
        variant="pri"
        icon={Radio}
        disabledReason={composeDisabledReason}
        reasonDisplay="tooltip"
        onClick={(event) => onCompose(event.currentTarget)}
      >
        Broadcast alert
      </Button>
    </div>
  );
}
