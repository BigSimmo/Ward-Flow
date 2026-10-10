"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { Button, StatusGlyph, buttonClass, durMinutes, type WfTone } from "@/components/wf";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  BED_CALL_MAX_BEDS,
  BROADCAST_ANSWER_LABELS,
  COORDINATOR_DESK_ACKNOWLEDGER_ID,
  READY_IN_CHOICES,
  broadcastKind,
  formatTimeRemaining,
  latestReplies,
  type BroadcastAlert,
  type BroadcastAnswer,
  type BroadcastReply,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import {
  bannerEntriesForDesk,
  deskName,
  replyBoard,
  type BannerEntry,
  type BannerTone,
} from "@/components/ward-management/alerts/global-alert-view";
import { resolveAlertSubject } from "@/components/ward-management/alerts/alerts-model";
import { useActNowNotificationPreference } from "@/components/ward-management/shell/ward-act-now-notifications";
import { currentDeskId } from "@/components/ward-management/settings/workstation-desks";
import { wardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { REFERRAL_DECLINE_REASONS, type ReferralDeclineReason } from "@/components/ward-management/ward-model";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";
import styles from "./ward-broadcast-banner.module.css";

interface WardBroadcastBannerProps {
  /** Overrides the desk read from the route. Tests and previews only. */
  currentUnitId?: string;
}

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

/**
 * THE ONE GLOBAL ALERT SLOT (option A, 10 Oct 2026). Sits under the top bar on every page and
 * shows the most urgent live alert for the desk this route is. Red (a thin edge, never a fill) only
 * when this desk must act now. No full screen flash: one pulse on arrival, then a steady edge.
 */
export function WardBroadcastBanner({ currentUnitId }: WardBroadcastBannerProps) {
  const { broadcastAlerts, dispatch, units, movements, patients, referrals } = useWardFlow();
  const now = useWardFlowClock();
  const pathname = usePathname() ?? "";
  const routeRole = wardChromeRole(pathname);
  const role = currentUnitId ? "ward" : routeRole;
  const routeDesk = currentUnitId ?? currentDeskId(pathname);
  const desk = { role, id: role === "coordinator" ? COORDINATOR_DESK_ACKNOWLEDGER_ID : routeDesk };

  const entries = bannerEntriesForDesk(broadcastAlerts, movements, desk, now);
  const top = entries[0];
  useActNowNotice(top, desk.id);

  if (!top) return null;
  const more = entries.length - 1;

  return (
    <BannerBody
      key={top.alert.id}
      entry={top}
      more={more}
      desk={desk}
      now={now}
      units={units}
      lookup={{ patients, referrals, movements }}
      onDispatch={dispatch}
    />
  );
}

type Lookup = Parameters<typeof resolveAlertSubject>[2];

function BannerBody({
  entry,
  more,
  desk,
  now,
  units,
  lookup,
  onDispatch,
}: {
  entry: BannerEntry;
  more: number;
  desk: { role: string; id: string | null };
  now: Instant;
  units: readonly { id: string; name: string }[];
  lookup: Lookup;
  onDispatch: ReturnType<typeof useWardFlow>["dispatch"];
}) {
  const { alert, tone, needsAnswer } = entry;
  const kind = broadcastKind(alert);
  const [choosing, setChoosing] = useState<BroadcastAnswer | null>(null);
  const [changing, setChanging] = useState(false);
  const isRed = tone === "act_now";
  const actingRole = desk.role === "coordinator" ? "coordinator" : desk.role === "ed" ? "ed" : "ward";

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
  const subject = kind === "pull_now" ? resolveAlertSubject(movement, alert.movementId, lookup, units) : undefined;
  const myReply = desk.id ? latestReplies(alert).get(desk.id) : undefined;
  const board = kind === "directive" ? undefined : replyBoard(alert, units);
  const showAnswers = (needsAnswer || changing) && kind !== "directive";

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
              <span className={styles.mono}>{subject.umrn}</span>
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
          ) : (
            <span className={styles.count} title={`${alert.acknowledgedUnits.length} units confirmed receipt`}>
              {alert.acknowledgedUnits.length} of {units.length} acknowledged
            </span>
          )}

          {kind === "directive" && desk.id ? (
            needsAnswer ? (
              <Button size="sm" icon={Check} onClick={acknowledge} title="Acknowledge this directive for your desk">
                Acknowledge
              </Button>
            ) : (
              <span className={styles.done}>
                <StatusGlyph tone="success" size={10} />
                Acknowledged
              </span>
            )
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

          <Link href={WARD_ALERTS_HREF} className={buttonClass({ size: "sm", variant: "ghost" })}>
            {more > 0 ? `Alerts, ${more} more` : "Alerts"}
            <ExternalLink size={14} aria-hidden="true" />
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

/**
 * A browser notification when a new red alert reaches this desk, using the act-now opt-in from
 * Settings. Carries no patient name or record number: the operating system may show it on a lock
 * screen.
 */
function useActNowNotice(top: BannerEntry | undefined, deskId: string | null) {
  const [enabled] = useActNowNotificationPreference();
  const seen = useRef<Set<string>>(new Set());
  const id = top?.tone === "act_now" ? `${top.alert.id}:${deskId ?? ""}` : null;
  useEffect(() => {
    if (!id || seen.current.has(id)) return;
    seen.current.add(id);
    if (!enabled || typeof window === "undefined" || window.Notification?.permission !== "granted") return;
    try {
      new window.Notification("Ward Flow: act now", {
        body: "A Pull now alert needs an answer. Synthetic demo data.",
        tag: "ward-flow-pull-now",
      });
    } catch {
      // Notifications are best effort.
    }
  }, [id, enabled]);
}
