"use client";

import { useState, type Ref } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronRight, UserRound } from "lucide-react";

import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import type { WardConfiguration } from "@/components/ward-management/ward-configuration";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { PLANNED_ADMISSION_REASON_LABELS } from "@/components/ward-management/ward-admissions";
import { decisionTargetReading } from "@/components/ward-management/ward-decision-targets";
import { inboxItemIsActNow } from "@/components/ward-management/ward-flow-reducer";
import {
  snoozeReasonLabel,
  type InboxOwnershipEntry,
  type InboxSnoozeEntry,
  type InboxSnoozeReason,
} from "@/components/ward-management/ward-inbox-snooze";
import { InboxRowStatus, InboxSnoozeControl, snoozedLine } from "@/components/ward-management/inbox-snooze-control";
import { declineReasonLabels } from "@/components/ward-management/movements/movement-workspace-derivations";
import {
  RELEASE_PULL_REASONS,
  changeReasonLabels,
  type ReleasePullReason,
} from "@/components/ward-management/ward-change-reasons";
import { Button, Field, Select, StatusGlyph, buttonClass } from "@/components/wf";

import {
  alertActionFor,
  alertDetail,
  alertGroupOf,
  alertKindOf,
  minutesText,
  raisedAt,
  type AlertSubject,
} from "./alerts-model";
import { DeclineLadder, WaitTrack, type TrackPoint } from "./alerts-visuals";
import { PullNowButton } from "./global-alert-panels";
import styles from "./alerts.module.css";

export type AlertDetailHandlers = {
  onTake: (item: InboxItem) => void;
  onAcknowledge: (item: InboxItem) => void;
  onSnooze: (item: InboxItem, until: Instant, reason: InboxSnoozeReason) => void;
  onReturn: (item: InboxItem) => void;
  onRelease: (item: InboxItem, reason: ReleasePullReason) => void;
};

/**
 * The selected alert: who, what, a picture of its recorded times, the facts behind it and every
 * action this screen can take on it. The right-hand panel on desktop and the sheet on a phone.
 */
export function AlertDetail({
  item,
  movement,
  subject,
  units,
  now,
  mine,
  acknowledgements,
  ownership,
  snoozeEntries,
  snoozedUntil,
  configuration,
  handlers,
  releaseRef,
  titleId,
}: {
  item: InboxItem;
  movement: Movement | undefined;
  subject: AlertSubject;
  units: readonly { id: string; name: string }[];
  now: Instant;
  mine: boolean;
  acknowledgements: readonly { at: Instant; by: string }[] | undefined;
  ownership: readonly InboxOwnershipEntry[] | undefined;
  snoozeEntries: readonly InboxSnoozeEntry[] | undefined;
  /** The live snooze on this row, when it is snoozed. */
  snoozedUntil: Extract<InboxSnoozeEntry, { kind: "snoozed" }> | undefined;
  configuration: WardConfiguration;
  handlers: AlertDetailHandlers;
  releaseRef?: Ref<HTMLSelectElement>;
  titleId?: string;
}) {
  const [releaseReason, setReleaseReason] = useState<ReleasePullReason | "">("");
  const kind = alertKindOf(item.id);
  const group = alertGroupOf(item);
  const opened = raisedAt(item, movement);
  const seen = acknowledgements?.at(-1);
  const action = alertActionFor(item, subject);
  const unitName = (id: string) => units.find((unit) => unit.id === id)?.name ?? id;
  const subjectLine = `${item.title}, ${subject.displayName}`;

  const booking = item.plannedAdmission;
  const facts: [string, string][] = [];
  if (booking) {
    facts.push(["Planned ward", subject.from]);
    facts.push(["Expected arrival", formatInstantWithDay(booking.expectedArrivalAt, now)]);
    facts.push(["Reason", PLANNED_ADMISSION_REASON_LABELS[booking.reason]]);
    facts.push(["Expected stay", `${booking.expectedStayDays} days`]);
    facts.push(["Legal status", booking.legalStatus]);
  } else {
    facts.push(["From", subject.from]);
    if (subject.to) facts.push(["To", subject.to]);
  }
  if (movement?.transport) {
    facts.push(["Provider", movement.transport.provider]);
    facts.push(["Escort", movement.transport.escortRequired ? "Required" : "Not required"]);
    if (movement.transport.acceptedAt !== undefined) {
      facts.push(["Accepted", formatInstantWithDay(movement.transport.acceptedAt, now)]);
    }
  }
  if (movement?.legalForm?.dueAt !== undefined)
    facts.push(["Form due", formatInstantWithDay(movement.legalForm.dueAt, now)]);
  facts.push(["Owner", item.owner]);

  const declines = kind === "declines" ? [...(movement?.declines ?? [])].sort((a, b) => b.at - a.at) : [];

  const track: TrackPoint[] = [];
  if (kind === "hold") {
    if (movement?.originEdId) track.push({ at: movement.openedAt, label: "Arrived ED", shape: "wait" });
    if (item.since !== undefined) track.push({ at: item.since, label: "Hold ended", shape: "act" });
  } else if (kind === "transport") {
    if (movement?.transport?.acceptedAt !== undefined) {
      track.push({ at: movement.transport.acceptedAt, label: "Transport accepted", shape: "wait" });
    }
  } else if (kind === "planned" && booking) {
    // A booking made days ahead would stretch the track past reading, so only a same-shift one shows.
    if (booking.expectedArrivalAt - booking.bookedAt <= 720) {
      track.push({ at: booking.bookedAt, label: "Booked", shape: "wait" });
    }
    track.push({ at: booking.expectedArrivalAt, label: "Expected", shape: "act" });
  } else if (kind === "legal") {
    if (item.dueAt !== undefined) track.push({ at: item.dueAt, label: "Form due", shape: "act" });
  } else if (kind === "target" || kind === "running") {
    const reading = movement ? decisionTargetReading(movement, now, configuration) : undefined;
    if (reading) {
      track.push({ at: reading.startedAt, label: "Started", shape: "wait" });
      track.push({ at: reading.dueAt, label: "Target", shape: reading.overdue ? "act" : "wait" });
    }
  }

  const activity: { at: Instant; text: string; done: boolean }[] = [];
  if (opened !== undefined) activity.push({ at: opened, text: `Raised, ${alertDetail(item)}`, done: false });
  for (const entry of acknowledgements ?? []) {
    activity.push({ at: entry.at, text: `Acknowledged by ${entry.by}`, done: true });
  }
  for (const entry of ownership ?? []) activity.push({ at: entry.at, text: `Taken by ${entry.by}`, done: true });
  for (const entry of snoozeEntries ?? []) {
    activity.push({
      at: entry.at,
      text:
        entry.kind === "snoozed"
          ? `Snoozed by ${entry.by}, ${snoozeReasonLabel(entry.reason).toLowerCase()}`
          : `Returned by ${entry.by}`,
      done: true,
    });
  }
  activity.sort((a, b) => b.at - a.at);

  return (
    <div className={styles.detail}>
      <div className={styles.detailHead}>
        <div className={styles.detailWho}>
          <h2 id={titleId} className={styles.detailName}>
            {subject.displayName}
          </h2>
          <span className={styles.detailSub}>
            <span className={styles.mono}>{subject.umrn}</span>
            {subject.legalStatus ? <> · {subject.legalStatus}</> : null}
          </span>
        </div>
        {subject.patientHref ? (
          <Link className={buttonClass({ variant: "ghost", size: "sm" })} href={subject.patientHref}>
            Patient
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <div className={styles.detailState}>
        <StatusGlyph tone={group === "act" ? "danger" : group === "wait" ? "warning" : "neutral"} />
        <span className={styles.detailTitle}>{item.title}</span>
        {opened !== undefined ? (
          <span className={styles.quiet}>
            open <span className={styles.mono}>{minutesText(Math.max(0, now - opened))}</span>
          </span>
        ) : null}
      </div>

      {kind === "declines" && declines.length > 0 ? (
        <section className={styles.detailSection} aria-label="Declines over time">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Declines over time</span>
            <span className={styles.quiet}>none accepted</span>
          </div>
          <DeclineLadder
            now={now}
            steps={declines.map((decline) => ({
              id: `${decline.unitId}-${decline.at}`,
              at: decline.at,
              short: unitName(decline.unitId).split(" ")[0] ?? decline.unitId,
              title: `${unitName(decline.unitId)}, ${declineReasonLabels[decline.reason] ?? decline.reason}, ${formatInstantWithDay(decline.at, now)}`,
            }))}
          />
        </section>
      ) : track.length > 0 ? (
        <section className={styles.detailSection} aria-label="Recorded times">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>{kind === "hold" ? "Time in ED" : "Recorded times"}</span>
            <span className={`${styles.quiet} ${styles.mono}`}>
              {minutesText(Math.max(0, now - Math.min(...track.map((point) => point.at))))}
            </span>
          </div>
          <WaitTrack points={track} now={now} />
        </section>
      ) : null}

      {declines.length > 0 ? (
        <section className={styles.detailSection} aria-label="Declined">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Declined {declines.length}</span>
          </div>
          <ul className={styles.declineList}>
            {declines.map((decline) => (
              <li key={`${decline.unitId}-${decline.at}`} className={styles.declineRow}>
                <StatusGlyph tone="neutral" size={9} />
                <span className={styles.declineText}>
                  <span className={styles.declineUnit}>{unitName(decline.unitId)}</span>
                  <span className={styles.quiet}>{declineReasonLabels[decline.reason] ?? decline.reason}</span>
                </span>
                <span className={styles.mono}>{formatInstantWithDay(decline.at, now)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <dl className={styles.facts} data-testid={booking ? "alerts-drawer-booking" : undefined}>
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <InboxRowStatus
        acknowledgements={acknowledgements}
        ownership={ownership}
        since={item.since}
        target={movement ? decisionTargetReading(movement, now, configuration) : undefined}
        now={now}
        className={styles.detailStatus}
      />

      <div className={styles.detailActions}>
        {snoozedUntil ? (
          <p className={styles.quiet}>{snoozedLine(snoozedUntil, now)}</p>
        ) : action.kind === "link" ? (
          <Link className={buttonClass({ variant: "pri", className: styles.wide })} href={action.href}>
            {action.label}
          </Link>
        ) : (
          <div className={styles.releaseRow}>
            <Field label="Reason for release" id={`alerts-release-${item.id}`}>
              <Select
                ref={releaseRef}
                value={releaseReason}
                onChange={(event) => setReleaseReason(event.target.value as ReleasePullReason | "")}
              >
                <option value="">Choose a reason</option>
                {RELEASE_PULL_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {changeReasonLabels[reason]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              variant="pri"
              disabledReason={releaseReason === "" ? "Choose a reason first" : undefined}
              reasonDisplay="tooltip"
              onClick={() => {
                if (releaseReason === "") return;
                handlers.onRelease(item, releaseReason);
                setReleaseReason("");
              }}
            >
              Release bed
            </Button>
          </div>
        )}
        <div className={styles.actionRow}>
          {movement ? <PullNowButton movement={movement} /> : null}
          <Button
            size="sm"
            icon={mine ? Check : UserRound}
            disabledReason={mine ? "You own this alert" : undefined}
            reasonDisplay="tooltip"
            aria-label={mine ? `You own ${subjectLine}` : `Take ${subjectLine}`}
            onClick={() => handlers.onTake(item)}
          >
            {mine ? "Yours" : "Take"}
          </Button>
          <Button
            size="sm"
            icon={seen ? Check : undefined}
            disabledReason={seen ? "Already acknowledged" : undefined}
            reasonDisplay="tooltip"
            aria-label={seen ? `Acknowledged ${subjectLine}` : `Acknowledge ${subjectLine}`}
            onClick={() => handlers.onAcknowledge(item)}
          >
            {seen ? "Seen" : "Acknowledge"}
          </Button>
          {snoozedUntil ? (
            <Button
              size="sm"
              aria-label={`Return ${item.title} now, ${subject.displayName}`}
              onClick={() => handlers.onReturn(item)}
            >
              Return now
            </Button>
          ) : (
            <InboxSnoozeControl
              subject={subjectLine}
              actNow={inboxItemIsActNow(item.id)}
              now={now}
              variant="sec"
              onSnooze={(until, reason) => handlers.onSnooze(item, until, reason)}
            />
          )}
        </div>
        <Button size="sm" variant="ghost" icon={ArrowUpRight} disabledReason="Not wired in this prototype.">
          Escalate
        </Button>
      </div>

      {activity.length > 0 ? (
        <section className={styles.detailSection} aria-label="Activity">
          <div className={styles.sectionHead}>
            <span className={styles.eyebrow}>Activity</span>
          </div>
          <ul className={styles.activity}>
            {activity.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <span className={styles.mono}>{formatInstantWithDay(entry.at, now)}</span>
                <StatusGlyph tone={entry.done ? "success" : group === "act" ? "danger" : "warning"} size={9} />
                <span>{entry.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
