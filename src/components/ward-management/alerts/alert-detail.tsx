"use client";

import { useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { DECLINE_REASON_NOT_SHARED } from "@/components/ward-management/ward-model";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronRight, UserRound } from "lucide-react";

import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
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
import { Button, Field, Select, StatusGlyph, buttonClass, useIsPhone } from "@/components/wf";

import {
  alertActionFor,
  alertDetail,
  alertGroupOf,
  alertKindOf,
  escalationAppliesTo,
  legalTypedEnd,
  minutesText,
  raisedAt,
  shownAgeFrom,
  type AlertSubject,
} from "./alerts-model";
import { typedTimeLine } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { DeclineLadder, WaitTrack, type TrackPoint } from "./alerts-visuals";
import { AlertArrivedAtWard } from "./alert-arrived-at-ward";
import { PullNowButton } from "./global-alert-panels";
import { ReleaseOwnershipButton } from "./alert-release-ownership";
import { officerHref } from "@/components/ward-management/shell/ward-facade";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import styles from "./alerts.module.css";
import rd from "./alert-detail-redesign.module.css";
import parts from "./alerts-screen-parts.module.css";

export type AlertDetailHandlers = {
  onTake: (item: InboxItem) => void;
  onAcknowledge: (item: InboxItem) => void;
  onSnooze: (item: InboxItem, until: Instant, reason: InboxSnoozeReason) => void;
  onReturn: (item: InboxItem) => void;
  onRelease: (item: InboxItem, reason: ReleasePullReason) => void;
  onEscalate?: (item: InboxItem) => void;
};

const PANEL_TABS = ["act", "activity"] as const;
type PanelTab = (typeof PANEL_TABS)[number];

/** "Cadwaller, Rhys" reads "RC": given name first, as people say it. Initials-only bookings keep theirs. */
function initialsOf(displayName: string): string {
  const initials = /^Initials\s+([A-Z]{1,3})$/u.exec(displayName)?.[1];
  if (initials) return initials;
  const [surname = "", given = ""] = displayName.split(",").map((part) => part.trim());
  return `${given.charAt(0)}${surname.charAt(0)}`.toUpperCase() || "?";
}

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
  actionDisabledReason,
  releaseRef,
  titleId,
}: {
  item: InboxItem;
  movement: Movement | undefined;
  subject: AlertSubject;
  units: readonly Unit[];
  now: Instant;
  mine: boolean;
  acknowledgements: readonly { at: Instant; by: string }[] | undefined;
  ownership: readonly InboxOwnershipEntry[] | undefined;
  snoozeEntries: readonly InboxSnoozeEntry[] | undefined;
  /** The live snooze on this row, when it is snoozed. */
  snoozedUntil: Extract<InboxSnoozeEntry, { kind: "snoozed" }> | undefined;
  configuration: WardConfiguration;
  handlers: AlertDetailHandlers;
  actionDisabledReason?: string;
  releaseRef?: Ref<HTMLSelectElement>;
  titleId?: string;
}) {
  const [releaseReason, setReleaseReason] = useState<ReleasePullReason | "">("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("act");
  const panelIds = useId();
  const tabRefs = useRef<Partial<Record<PanelTab, HTMLButtonElement | null>>>({});
  const onPanelTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = PANEL_TABS.indexOf(panelTab);
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? PANEL_TABS[(at + 1) % PANEL_TABS.length]
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? PANEL_TABS[(at - 1 + PANEL_TABS.length) % PANEL_TABS.length]
          : event.key === "Home"
            ? PANEL_TABS[0]
            : event.key === "End"
              ? PANEL_TABS[PANEL_TABS.length - 1]
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setPanelTab(next);
    tabRefs.current[next]?.focus();
  };
  // Whether Escalate means anything for THIS alert comes first: a movement's escalation record belongs
  // to its bed search, so an unrelated alert on the same movement must not claim it was escalated.
  const escalationApplies = escalationAppliesTo(item, movement, units, now);
  const isEscalated = escalationApplies && Boolean(movement?.escalation);
  const isPhone = useIsPhone();
  const kind = alertKindOf(item.id);
  const group = alertGroupOf(item);
  // A passed legal form shows its typed time, never an age since it (legal times only as typed).
  const legalEnded = legalTypedEnd(item);
  const opened = raisedAt(item, movement);
  const openedShown = shownAgeFrom(item, opened);
  const seen = acknowledgements?.at(-1);
  // Transport officer: the desk opens only its own jobs, Alerts, On-call and Settings (ROLE_SCREENS).
  // The coordinator's forward link (a movement, a patient, the bed search) is a page this desk cannot
  // open, so every alert's one action opens the officer's job list instead, and Patient is left out.
  const officerDesk = useEffectiveWardAccess().role === "officer";
  const action: ReturnType<typeof alertActionFor> = officerDesk
    ? { kind: "link", label: "Open my jobs", href: officerHref() }
    : alertActionFor(item, subject);
  // P085 (27 Oct 2026): when the action already opens the patient, one link to them is enough. A
  // snoozed alert shows no action, so it keeps the Patient link.
  const patientLink = officerDesk
    ? undefined
    : !snoozedUntil && action.kind === "link" && action.href === subject.patientHref
      ? undefined
      : subject.patientHref;
  const unitName = (id: string) => units.find((unit) => unit.id === id)?.name ?? id;
  // "for", not a comma: the family-first name has its own comma ("Smith, Alice").
  const subjectLine = `${item.title} for ${subject.displayName}`;
  const declineCount = movement?.declines?.length ?? 0;
  // Alerts redesign: one plain sentence on the state card, and one on what the Act tab's button does.
  const stateNote =
    kind === "hold"
      ? `The bed is still held${subject.to ? ` at ${subject.to}` : ""}. Release it or pull again.`
      : kind === "declines"
        ? `${declineCount} ${declineCount === 1 ? "ward has" : "wards have"} declined. No ward has accepted.`
        : kind === "nobed"
          ? "No ward in the network is eligible now."
          : kind === "planned" && item.plannedAdmission
            ? `Expected at ${formatInstantWithDay(item.plannedAdmission.expectedArrivalAt, now)}. No arrival recorded.`
            : kind === "transport"
              ? "Accepted and booked. Not left yet."
              : kind === "notify"
                ? "Carer, personal support person and advocacy notifications are not recorded."
                : undefined;
  const actNote =
    kind === "hold"
      ? "Release needs a reason. Pull again keeps the bed for another pull limit."
      : kind === "nobed"
        ? "Escalate when the bed search is exhausted. It records that the state desk was rung."
        : kind === "planned"
          ? "Record the arrival, or open the booking to change the time or cancel it."
          : kind === "transport"
            ? "Chase opens the booking with the provider's number. Record the departure once they leave."
            : kind === "notify"
              ? "Record who was told, or record that a notification is not needed."
              : undefined;

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
    // Transport officer: no Accepted fact; the recorded times and Activity both carry it.
    if (movement.transport.acceptedAt !== undefined && !officerDesk) {
      facts.push(["Accepted", formatInstantWithDay(movement.transport.acceptedAt, now)]);
    }
  }
  if (movement?.legalForm?.dueAt !== undefined)
    facts.push(["Form due", formatInstantWithDay(movement.legalForm.dueAt, now)]);
  // An alert nobody owns (the transport officer's) has no Owner line, rather than a blank one.
  if (item.owner) facts.push(["Owner", item.owner]);

  const declines = kind === "declines" ? [...(movement?.declines ?? [])].sort((a, b) => b.at - a.at) : [];

  const track: TrackPoint[] = [];
  if (kind === "hold") {
    if (movement?.originEdId) track.push({ at: movement.openedAt, label: "Arrived ED", shape: "wait" });
    if (item.since !== undefined) track.push({ at: item.since, label: "Pull ended", shape: "act" });
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
  for (const entry of ownership ?? []) {
    activity.push({
      at: entry.at,
      text: `${entry.kind === "released" ? "Released" : "Taken"} by ${entry.by}`,
      done: true,
    });
  }
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

  const pictureSection =
    kind === "declines" && declines.length > 0 ? (
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
            title: `${unitName(decline.unitId)}, ${decline.reason ? (declineReasonLabels[decline.reason] ?? decline.reason) : DECLINE_REASON_NOT_SHARED}, ${formatInstantWithDay(decline.at, now)}`,
          }))}
        />
      </section>
    ) : track.length > 0 ? (
      <section className={styles.detailSection} aria-label="Recorded times">
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>{kind === "hold" ? "Time in ED" : "Recorded times"}</span>
          <span className={`${styles.quiet} ${styles.mono}`}>
            {legalEnded !== undefined
              ? typedTimeLine(legalEnded, now)
              : minutesText(Math.max(0, now - Math.min(...track.map((point) => point.at))))}
          </span>
        </div>
        <WaitTrack points={track} now={now} />
      </section>
    ) : null;

  // Device audit (11 Oct 2026): the sheet and the rail show two actions (the primary and Take), and the
  // rest sit behind one "More actions" disclosure instead of a grid of equal buttons.
  const ownButton = (
    <Button
      size="sm"
      icon={mine ? Check : UserRound}
      disabledReason={actionDisabledReason ?? (mine ? "You own this alert" : undefined)}
      reasonDisplay="tooltip"
      aria-label={mine ? `Yours: ${subjectLine}` : `Take ${subjectLine}`}
      onClick={() => handlers.onTake(item)}
    >
      {mine ? "Yours" : "Take"}
    </Button>
  );
  // P019: an alert you took offers Hand back (the Alerts redesign's name for P019's Release) in place
  // of the greyed "Yours".
  const takeButton = mine ? (
    <ReleaseOwnershipButton
      item={item}
      subjectLine={subjectLine}
      disabledReason={actionDisabledReason}
      fallback={ownButton}
    />
  ) : (
    ownButton
  );
  const moreActions = (
    <details className={styles.moreActions} data-testid="alerts-more-actions">
      <summary>More actions</summary>
      <div className={styles.moreGrid}>
        {movement && !actionDisabledReason ? <PullNowButton movement={movement} /> : null}
        <Button
          size="sm"
          icon={seen ? Check : undefined}
          disabledReason={actionDisabledReason ?? (seen ? "Already acknowledged" : undefined)}
          reasonDisplay="tooltip"
          aria-label={seen ? `Seen: ${subjectLine}` : `Acknowledge ${subjectLine}`}
          onClick={() => handlers.onAcknowledge(item)}
        >
          {seen ? "Seen" : "Acknowledge"}
        </Button>
        {snoozedUntil ? (
          <Button
            size="sm"
            aria-label={`Return ${item.title} now for ${subject.displayName}`}
            disabledReason={actionDisabledReason}
            onClick={() => handlers.onReturn(item)}
          >
            Return now
          </Button>
        ) : actionDisabledReason ? (
          <Button size="sm" disabledReason={actionDisabledReason} aria-label={`Snooze ${subjectLine}`}>
            Snooze
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
        <Button
          size="sm"
          variant="ghost"
          icon={isEscalated ? Check : ArrowUpRight}
          disabledReason={
            actionDisabledReason ??
            (!movement
              ? "This alert has no movement to escalate"
              : !escalationApplies
                ? "Escalation is only for an exhausted bed search"
                : isEscalated
                  ? "Already escalated"
                  : undefined)
          }
          reasonDisplay="tooltip"
          aria-label={isEscalated ? `Escalated ${subjectLine}` : `Escalate ${subjectLine}`}
          onClick={() => {
            if (movement && escalationApplies && !isEscalated) handlers.onEscalate?.(item);
          }}
        >
          {isEscalated ? "Escalated" : "Escalate"}
        </Button>
      </div>
    </details>
  );

  const activityList = (
    <ul className={styles.activity}>
      {activity.map((entry, index) => (
        <li key={`${entry.at}-${index}`}>
          <span className={styles.mono}>{formatInstantWithDay(entry.at, now)}</span>
          <StatusGlyph tone={entry.done ? "success" : group === "act" ? "danger" : "warning"} size={9} />
          <span>{entry.text}</span>
        </li>
      ))}
    </ul>
  );

  if (isPhone) {
    /* v10 Alerts, phone: who and how long under the sheet's title, the facts as a boxed grid, the
     * recorded times as a card, the reason, the actions two by two, activity one tap away, and the
     * Patient link with the one primary pinned at the foot. */
    const phoneFacts: [string, string][] = facts.filter(([label]) => label !== "Owner" && label !== "Form due");
    const legal = movement?.legalForm ? `Form ${movement.legalForm.code}` : subject.legalStatus;
    if (!booking && legal) phoneFacts.push(["Legal status", legal]);
    if (item.owner) phoneFacts.push(["Owner", item.owner]);
    const formDue = facts.find(([label]) => label === "Form due");
    if (formDue) phoneFacts.push(formDue);
    return (
      <div className={`${styles.detail} ${styles.phDetail}`}>
        <div className={styles.phWho}>
          <h2 id={titleId} className={styles.phWhoName}>
            {subject.displayName} <span className={styles.mono}>{subject.umrn}</span>
          </h2>
          <div className={styles.phChips}>
            {group === "act" || group === "wait" ? (
              <span className={styles.phChip}>
                <StatusGlyph tone={group === "act" ? "danger" : "warning"} size={9} />
                {group === "act" ? "Act now" : "Waiting"}
              </span>
            ) : null}
            {openedShown !== undefined ? (
              <span className={styles.phChip}>
                open <span className={styles.mono}>{minutesText(Math.max(0, now - openedShown))}</span>
              </span>
            ) : legalEnded !== undefined ? (
              <span className={styles.phChip}>{typedTimeLine(legalEnded, now)}</span>
            ) : null}
          </div>
        </div>

        {declines.length > 0 ? null : (
          <dl
            className={`${styles.phFacts} ${parts.phFactsWrap}`}
            data-testid={booking ? "alerts-drawer-booking" : undefined}
          >
            {phoneFacts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {pictureSection ? <div className={styles.phBox}>{pictureSection}</div> : null}

        {declines.length > 0 ? (
          <section className={styles.phBox} aria-label="Declined">
            <div className={styles.detailSection}>
              <div className={styles.sectionHead}>
                <span className={styles.eyebrow}>Declined {declines.length}</span>
              </div>
              <ul className={styles.declineList}>
                {declines.map((decline) => (
                  <li key={`${decline.unitId}-${decline.at}`} className={styles.declineRow}>
                    <StatusGlyph tone="neutral" size={9} />
                    <span className={styles.declineText}>
                      <span className={styles.declineUnit}>{unitName(decline.unitId)}</span>
                      <span className={styles.quiet}>
                        {decline.reason
                          ? (declineReasonLabels[decline.reason] ?? decline.reason)
                          : DECLINE_REASON_NOT_SHARED}
                      </span>
                    </span>
                    <span className={styles.mono}>{formatInstantWithDay(decline.at, now)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <InboxRowStatus
          acknowledgements={acknowledgements}
          ownership={ownership}
          since={item.since}
          target={movement ? decisionTargetReading(movement, now, configuration) : undefined}
          now={now}
          className={styles.detailStatus}
        />

        {snoozedUntil ? <p className={styles.quiet}>{snoozedLine(snoozedUntil, now)}</p> : null}
        {!snoozedUntil && action.kind !== "link" ? (
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
        ) : null}

        {/* Transport officer: Take, Acknowledge, Snooze and Escalate are the coordinator's, so they are
            left out and the app's own sentence says why, once. */}
        {officerDesk ? (
          <p className={styles.quiet}>{actionDisabledReason}</p>
        ) : (
          <>
            <div className={styles.phActions}>{takeButton}</div>
            {moreActions}
          </>
        )}

        {activity.length > 0 ? (
          <section aria-label="Activity" className={styles.phActivity}>
            <button
              type="button"
              className={styles.phActivityToggle}
              aria-expanded={activityOpen}
              onClick={() => setActivityOpen((open) => !open)}
            >
              {activityOpen ? "Hide activity" : "Show activity"}
            </button>
            {activityOpen ? activityList : null}
          </section>
        ) : null}

        <div className={styles.phFoot}>
          {patientLink ? (
            <Link className={buttonClass({ variant: "sec" })} href={patientLink}>
              Patient
            </Link>
          ) : null}
          {snoozedUntil ? null : action.kind === "link" ? (
            <Link className={buttonClass({ variant: "pri" })} href={action.href}>
              {action.label}
            </Link>
          ) : (
            <>
              <Button
                variant="pri"
                disabledReason={actionDisabledReason ?? (releaseReason === "" ? "Choose a reason first" : undefined)}
                reasonDisplay="tooltip"
                onClick={() => {
                  if (releaseReason === "") return;
                  handlers.onRelease(item, releaseReason);
                  setReleaseReason("");
                }}
              >
                {/* CT-19: the reason-gated release names its patient at the point of commit. */}
                Release pulled bed for {subject.displayName}
              </Button>
              {movement ? (
                <AlertArrivedAtWard
                  movement={movement}
                  displayName={subject.displayName}
                  disabledReason={actionDisabledReason}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.detail} ${rd.detail}`}>
      <div className={`${styles.detailHead} ${rd.head}`}>
        <span className={rd.avatar} aria-hidden="true">
          {initialsOf(subject.displayName)}
        </span>
        <div className={styles.detailWho}>
          <h2 id={titleId} className={styles.detailName}>
            {subject.displayName}
          </h2>
          <span className={styles.detailSub}>
            {/* No leading " · " when this desk is not shown the UMRN (the transport officer). */}
            {subject.umrn ? <span className={styles.mono}>{subject.umrn}</span> : null}
            {subject.umrn && subject.legalStatus ? " · " : null}
            {subject.legalStatus ?? null}
          </span>
        </div>
        {patientLink ? (
          <Link className={buttonClass({ variant: "ghost", size: "sm" })} href={patientLink}>
            Patient
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <div className={rd.state} data-act={group === "act" ? "true" : undefined}>
        <div className={`${styles.detailState} ${rd.stateTop}`}>
          <StatusGlyph tone={group === "act" ? "danger" : group === "wait" ? "warning" : "neutral"} />
          <span className={styles.detailTitle}>{item.title}</span>
          {/* Transport officer: the age shows once, on Recorded times just below, when they show. */}
          {openedShown !== undefined &&
          (!officerDesk || track.length === 0 || (kind === "declines" && declines.length > 0)) ? (
            <span className={styles.quiet}>
              open <span className={styles.mono}>{minutesText(Math.max(0, now - openedShown))}</span>
            </span>
          ) : legalEnded !== undefined ? (
            <span className={styles.quiet}>{typedTimeLine(legalEnded, now)}</span>
          ) : null}
        </div>
        {stateNote ? <p className={rd.stateNote}>{stateNote}</p> : null}

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
                title: `${unitName(decline.unitId)}, ${decline.reason ? (declineReasonLabels[decline.reason] ?? decline.reason) : DECLINE_REASON_NOT_SHARED}, ${formatInstantWithDay(decline.at, now)}`,
              }))}
            />
          </section>
        ) : track.length > 0 ? (
          <section className={styles.detailSection} aria-label="Recorded times">
            <div className={styles.sectionHead}>
              <span className={styles.eyebrow}>{kind === "hold" ? "Time in ED" : "Recorded times"}</span>
              <span className={`${styles.quiet} ${styles.mono}`}>
                {legalEnded !== undefined
                  ? typedTimeLine(legalEnded, now)
                  : minutesText(Math.max(0, now - Math.min(...track.map((point) => point.at))))}
              </span>
            </div>
            <WaitTrack points={track} now={now} />
          </section>
        ) : null}
      </div>

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
                  <span className={styles.quiet}>
                    {decline.reason
                      ? (declineReasonLabels[decline.reason] ?? decline.reason)
                      : DECLINE_REASON_NOT_SHARED}
                  </span>
                </span>
                <span className={styles.mono}>{formatInstantWithDay(decline.at, now)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <dl className={`${styles.facts} ${rd.facts}`} data-testid={booking ? "alerts-drawer-booking" : undefined}>
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

      {/* Alerts redesign: Act and Activity tabs, then the action bar pinned to the bottom. */}
      <div className={rd.tabs} role="tablist" aria-label="Alert">
        {PANEL_TABS.map((tabId) => (
          <button
            key={tabId}
            ref={(node) => {
              tabRefs.current[tabId] = node;
            }}
            type="button"
            role="tab"
            id={`${panelIds}-tab-${tabId}`}
            aria-controls={`${panelIds}-panel`}
            aria-selected={panelTab === tabId}
            // One tab stop; the arrow keys, Home and End move between Act and Activity.
            tabIndex={panelTab === tabId ? 0 : -1}
            className={rd.tab}
            onClick={() => setPanelTab(tabId)}
            onKeyDown={onPanelTabKey}
          >
            {tabId === "act" ? "Act" : "Activity"}
            {tabId === "activity" && activity.length > 0 ? (
              <>
                {" "}
                <span className={rd.tabCount}>{activity.length}</span>
              </>
            ) : null}
          </button>
        ))}
      </div>
      <div className={rd.body} role="tabpanel" id={`${panelIds}-panel`} aria-labelledby={`${panelIds}-tab-${panelTab}`}>
        {panelTab === "activity" ? (
          activity.length > 0 ? (
            <ul className={rd.activity}>
              {activity.map((entry, index) => (
                <li key={`${entry.at}-${index}`}>
                  <time>{formatInstantWithDay(entry.at, now)}</time>
                  <StatusGlyph tone={entry.done ? "success" : group === "act" ? "danger" : "warning"} size={9} />
                  <span>{entry.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nothing recorded on this alert yet.</p>
          )
        ) : actNote ? (
          <p>{actNote}</p>
        ) : null}
      </div>

      <div className={`${styles.detailActions} ${rd.foot}`}>
        {snoozedUntil ? (
          <p className={styles.quiet}>{snoozedLine(snoozedUntil, now)}</p>
        ) : action.kind === "link" ? (
          <Link
            className={buttonClass({ variant: "pri", className: `${styles.wide} ${rd.primary}` })}
            href={action.href}
          >
            {/* Safety rule 5: every main button names the person. */}
            {officerDesk ? action.label : `${action.label} for ${subject.displayName}`}
          </Link>
        ) : (
          <div className={`${styles.releaseRow} ${parts.releaseRow}`}>
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
            {/* Alerts redesign: one full-width Release, with "Choose a reason first" written under it. */}
            <div className={parts.releaseAction}>
              <Button
                variant="pri"
                disabledReason={actionDisabledReason ?? (releaseReason === "" ? "Choose a reason first" : undefined)}
                reasonDisplay="inline"
                onClick={() => {
                  if (releaseReason === "") return;
                  handlers.onRelease(item, releaseReason);
                  setReleaseReason("");
                }}
              >
                {/* CT-19: the reason-gated release names its patient at the point of commit. */}
                Release pulled bed for {subject.displayName}
              </Button>
            </div>
            {movement ? (
              <AlertArrivedAtWard
                movement={movement}
                displayName={subject.displayName}
                disabledReason={actionDisabledReason}
              />
            ) : null}
          </div>
        )}
        {/* Alerts redesign: Take or Hand back and More actions on one row. Transport officer: those
            are the coordinator's, so the app's own sentence stands in their place. */}
        {officerDesk ? (
          <p className={styles.quiet}>{actionDisabledReason}</p>
        ) : (
          <div className={`${styles.actionRow} ${parts.actionsRow} ${rd.secRow}`}>
            {takeButton}
            {moreActions}
          </div>
        )}
      </div>
    </div>
  );
}
