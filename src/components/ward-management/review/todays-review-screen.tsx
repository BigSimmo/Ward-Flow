"use client";

import { Check, ClipboardCheck, Clock } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Badge,
  Button,
  buttonClass,
  Card,
  CardHead,
  EmptyState,
  Hero,
  HeroStat,
  StatusGlyph,
  type WfTone,
} from "@/components/wf";
import { PillTabs } from "@/components/wf/choice";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { activeTaskItems } from "@/components/ward-management/ward-act-now-items";
import type { AuditEvent, AuditReview } from "@/components/ward-management/ward-audit";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { allDeclines } from "@/components/ward-management/ward-derivations";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { DECLINE_REASON_NOT_SHARED, type Unit } from "@/components/ward-management/ward-model";
import { usePatientOf, useUmrnText } from "@/components/ward-management/ward-patient-name";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { refusalReasonText, refusedActionText } from "@/components/ward-management/ward-refusal-words";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { actor, subjectLabel } from "@/components/ward-management/governance-shared";

import {
  overridesToReview,
  todaysReview,
  type ReviewEvent,
  type ReviewFilter,
  type ReviewTodo,
} from "./todays-review-derivations";
import styles from "./todays-review.module.css";

const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "decline", label: "Declines" },
  { id: "override", label: "Overrides" },
  { id: "problem", label: "Problems" },
  { id: "stopped", label: "Stopped by the app" },
];

const TAGS: Record<ReviewEvent["kind"], { label: string; tone: WfTone }> = {
  decline: { label: "Declined", tone: "closed" },
  override: { label: "Override", tone: "info" },
  stopped: { label: "Stopped", tone: "neutral" },
  problem: { label: "Problem", tone: "warning" },
};

const NONE_EVENTS: readonly AuditEvent[] = [];
const NONE_REVIEWS: readonly AuditReview[] = [];

const BED_MEETING_HREF = "/ward-flow/bed-meeting/agenda";
const HANDOVER_HREF = "/ward-flow/handover";
const ALERTS_HREF = "/ward-flow/alerts";

const unitName = (units: readonly Unit[], id: string) => units.find((unit) => unit.id === id)?.name ?? "A ward";
const declineReasonText = (reason: string | undefined) =>
  reason ? (DECLINE_REASON_LABELS[reason as keyof typeof DECLINE_REASON_LABELS] ?? reason) : DECLINE_REASON_NOT_SHARED;
const overrideReason = (event: AuditEvent) =>
  event.category === "override" && event.details.reason ? event.details.reason : "Reason not recorded";

/**
 * Today's review (Home notes 4, issue 4, 9 Nov 2026): replaces Home's four Registers tabs with one
 * page. "Before you hand over" holds what needs the coordinator; "Everything today" lists every
 * decline, override, open problem and action the app stopped, newest first, with a ward's repeated
 * declines on one line. The filter row uses the shared header's quiet stage-filter style.
 */
export function TodaysReviewScreen() {
  const {
    movements,
    units,
    configuration,
    inboxSnoozes,
    admissions,
    patients,
    referrals,
    supportNotifications,
    plannedAdmissions,
    leaveBeds,
    rejections,
    worldGeneration,
    readAuditReviews,
    readGovernanceAuditEvents,
    readAuditEvents,
    dispatch,
  } = useWardFlowSelect(
    "movements",
    "units",
    "configuration",
    "inboxSnoozes",
    "admissions",
    "patients",
    "referrals",
    "supportNotifications",
    "plannedAdmissions",
    "leaveBeds",
    "rejections",
    "worldGeneration",
    "readAuditReviews",
    "readGovernanceAuditEvents",
    "readAuditEvents",
    "dispatch",
  );
  const now = useWardFlowClock();
  const patientOf = usePatientOf();
  const umrnText = useUmrnText();
  const gate = useRoleGate();
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  const eventRead = readGovernanceAuditEvents?.(actor) ?? readAuditEvents(actor);
  const reviewRead = readAuditReviews(actor);
  const auditEvents = eventRead.status === "allowed" ? eventRead.value : NONE_EVENTS;
  const auditReviews = reviewRead.status === "allowed" ? reviewRead.value : NONE_REVIEWS;

  const problems = useMemo(
    () =>
      activeTaskItems(
        {
          movements,
          units,
          configuration,
          inboxSnoozes,
          admissions,
          patients,
          referrals,
          supportNotifications,
          plannedAdmissions,
          leaveBeds,
          stuckHandoverMinutes: configuration.transportBookedTargetMinutes,
        },
        now,
      ),
    [
      movements,
      units,
      configuration,
      inboxSnoozes,
      admissions,
      patients,
      referrals,
      supportNotifications,
      plannedAdmissions,
      leaveBeds,
      now,
    ],
  );
  const review = useMemo(
    () =>
      todaysReview({
        declines: allDeclines(movements),
        auditEvents,
        auditReviews,
        rejections,
        problems,
        generation: worldGeneration,
        now,
      }),
    [movements, auditEvents, auditReviews, rejections, problems, worldGeneration, now],
  );
  const left = overridesToReview(review.todos);
  const shown = filter === "all" ? review.events : review.events.filter((event) => event.kind === filter);
  const shiftLabel = formatInstantWithDay(now, now);

  function markReviewed(event: AuditEvent) {
    if (!gate("REVIEW_AUDIT_EVENT", event.id).allowed || pending.has(event.id)) return;
    setPending((current) => new Set(current).add(event.id));
    const count = auditReviews.filter(
      (entry) => entry.eventId === event.id && entry.generation === event.generation,
    ).length;
    const settle = () =>
      setPending((current) => {
        const next = new Set(current);
        next.delete(event.id);
        return next;
      });
    try {
      const outcome = dispatch({
        type: "REVIEW_AUDIT_EVENT",
        role: "coordinator",
        now,
        eventId: event.id,
        expectedGeneration: event.generation,
        expectedReviewCount: count,
        decision: "reviewed",
      });
      if (outcome && typeof outcome === "object" && "then" in outcome) void outcome.then(settle, settle);
      else settle();
    } catch {
      settle();
    }
  }

  function toggleGroup(id: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function todoRow(todo: ReviewTodo) {
    if (todo.kind === "override") {
      const event = todo.event;
      const reviewGate = gate("REVIEW_AUDIT_EVENT", event.id);
      const at = event.at === null ? "Time not recorded" : formatInstantWithDay(event.at, now);
      return (
        <li key={todo.id} className={styles.todo} data-done={todo.done || undefined} data-testid={todo.id}>
          <span className={styles.mark} aria-hidden="true">
            {todo.done ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : "!"}
          </span>
          <span className={styles.todoText}>
            <span className={styles.todoTitle}>Review an override for {subjectLabel(event, patientOf)}</span>
            <span className={styles.todoDetail}>
              {at}. Reason given: {overrideReason(event)}.
            </span>
          </span>
          {todo.done ? (
            <span className={styles.doneLabel}>
              <Check size={14} strokeWidth={2} aria-hidden="true" />
              Reviewed
            </span>
          ) : (
            <span className={styles.todoAction}>
              <Button
                variant="sec"
                size="sm"
                {...reviewGate.buttonProps}
                disabled={!reviewGate.allowed || pending.has(event.id)}
                onClick={() => markReviewed(event)}
              >
                {pending.has(event.id) ? "Saving…" : "Mark reviewed"}
              </Button>
              {reviewGate.note}
            </span>
          )}
        </li>
      );
    }
    if (todo.kind === "repeat-declines") {
      const ward = unitName(units, todo.unitId);
      return (
        <li key={todo.id} className={styles.todo} data-testid={todo.id}>
          <span className={styles.mark} aria-hidden="true">
            !
          </span>
          <span className={styles.todoText}>
            <span className={styles.todoTitle}>
              {ward} declined {todo.count} times for the same reason
            </span>
            <span className={styles.todoDetail}>
              All {todo.count} for {declineReasonText(todo.reason).toLowerCase()}. Worth raising with the ward.
            </span>
          </span>
          <Link
            href={BED_MEETING_HREF}
            className={`${buttonClass({ variant: "sec", size: "sm" })} ${styles.todoAction}`}
          >
            Open bed meeting
          </Link>
        </li>
      );
    }
    return (
      <li key={todo.id} className={styles.todo} data-testid={todo.id}>
        <span className={styles.mark} aria-hidden="true">
          !
        </span>
        <span className={styles.todoText}>
          <span className={styles.todoTitle}>
            {todo.count} {todo.count === 1 ? "problem" : "problems"} still open
          </span>
          <span className={styles.todoDetail}>Each one is also in My list. Hand over any you will not clear.</span>
        </span>
        <Link href={HANDOVER_HREF} className={`${buttonClass({ variant: "sec", size: "sm" })} ${styles.todoAction}`}>
          Open Handover
        </Link>
      </li>
    );
  }

  function eventRow(event: ReviewEvent) {
    const tag = TAGS[event.kind];
    const time = event.at === undefined ? "Open" : formatInstantWithDay(event.at, now);
    let text: string;
    let sub: string | undefined;
    let members: { id: string; time: string; text: string }[] | undefined;
    switch (event.kind) {
      case "decline": {
        const ward = unitName(units, event.unitId);
        const first = event.members[0]!;
        if (event.members.length === 1) {
          text = `${ward} declined ${patientOf({ movementId: first.movement.id }).displayName}`;
          sub = `Reason: ${declineReasonText(first.decline.reason)}.`;
        } else {
          const reasons = new Set(event.members.map((entry) => entry.decline.reason));
          const only = reasons.size === 1 ? [...reasons][0] : undefined;
          text = `${ward} declined ${event.members.length} referrals today${
            only ? `, all for ${declineReasonText(only).toLowerCase()}` : ""
          }`;
          members = event.members.map((entry, index) => ({
            id: `${event.id}-${index}`,
            time: formatInstantWithDay(entry.decline.at, now),
            text: `${patientOf({ movementId: entry.movement.id }).displayName} · ${declineReasonText(entry.decline.reason)}`,
          }));
        }
        break;
      }
      case "override":
        text = `Override for ${subjectLabel(event.event, patientOf)}`;
        sub = `Reason: ${overrideReason(event.event)}.${event.reviewed ? " Reviewed." : ""}`;
        break;
      case "stopped":
        text = `The app stopped: ${refusedActionText(event.rejection.attempted)}`;
        sub = refusalReasonText(event.rejection.reason);
        break;
      case "problem":
        text = umrnText(event.item.title);
        sub = umrnText(event.item.detail);
        break;
    }
    const open = openGroups.has(event.id);
    const groupId = `${event.id}-members`;
    return (
      <li key={event.id} className={styles.event} data-kind={event.kind} data-testid={`review-event-${event.id}`}>
        <span className={styles.eventTime}>{time}</span>
        <Badge tone={tag.tone} size="sm" className={styles.eventTag}>
          {tag.label}
        </Badge>
        <span className={styles.eventText}>
          {text}
          {sub ? <span className={styles.eventSub}>{sub}</span> : null}
        </span>
        {members ? (
          <Button
            variant="ghost"
            size="sm"
            className={styles.eventToggle}
            aria-expanded={open}
            aria-controls={groupId}
            onClick={() => toggleGroup(event.id)}
          >
            {open ? "Hide" : `Show ${members.length}`}
          </Button>
        ) : event.kind === "problem" ? (
          <Link href={ALERTS_HREF} className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.eventToggle}`}>
            Open
          </Link>
        ) : (
          <span className={styles.eventToggle} />
        )}
        {members ? (
          <ul id={groupId} className={styles.members} hidden={!open}>
            {members.map((member) => (
              <li key={member.id}>
                <span className={styles.eventTime}>{member.time}</span>
                <span>{member.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <main id="main-content" className={styles.main} data-testid="ward-todays-review">
      <Hero
        level={1}
        eyebrow="Activity"
        title="Today's review"
        titleMeta={`Statewide · as at ${shiftLabel}`}
        stats={
          <>
            <HeroStat value={left} label="Overrides to review" tone={left > 0 ? "warning" : undefined} />
            <HeroStat value={review.counts.decline} label="Declines" />
            <HeroStat value={review.counts.override} label="Overrides" />
            <HeroStat value={review.counts.problem} label="Open problems" />
          </>
        }
      />

      <div className={styles.grid}>
        <Card aria-labelledby="review-handover-title" data-testid="review-before-handover">
          <CardHead
            title={<span id="review-handover-title">Before you hand over</span>}
            icon={ClipboardCheck}
            iconPlain
            aside={
              <Badge tone={left > 0 ? "warning" : "success"} size="sm">
                {left > 0 ? `${left} to review` : "Overrides reviewed"}
              </Badge>
            }
          />
          {review.todos.length === 0 ? (
            <EmptyState title="All clear" meta="Nothing to settle before handover." />
          ) : (
            <ul className={styles.todos}>{review.todos.map(todoRow)}</ul>
          )}
        </Card>

        <Card aria-labelledby="review-today-title" data-testid="review-everything-today">
          <CardHead
            title={<span id="review-today-title">Everything today</span>}
            icon={Clock}
            iconPlain
            meta="Newest first"
          />
          <div className={styles.filterRow}>
            <PillTabs
              label="Show"
              items={FILTERS.map((item) => ({ ...item, count: review.counts[item.id] }))}
              value={filter}
              onChange={setFilter}
              idPrefix="review-filter"
              className={styles.quiet}
            />
          </div>
          <div role="tabpanel" id={`review-filter-panel-${filter}`} aria-labelledby={`review-filter-tab-${filter}`}>
            {shown.length === 0 ? (
              <EmptyState
                title={filter === "all" ? "Nothing off-plan today" : "None today"}
                meta={`Checked at ${formatInstantWithDay(now, now)}`}
              />
            ) : (
              <ul className={styles.events}>{shown.map(eventRow)}</ul>
            )}
          </div>
        </Card>
      </div>

      <p className={styles.footNote}>
        <StatusGlyph tone="info" size={9} /> Marking an override reviewed is kept with the governance record, with the
        coordinator role and time. Full history is in <Link href="/ward-flow/governance">Governance</Link>.
      </p>

      <WardPrototypeFooter testId="ward-todays-review-footer" />
    </main>
  );
}
