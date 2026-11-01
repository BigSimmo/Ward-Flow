"use client";

// The Movements worklist row (StageRow) and the small pieces the screen draws beside it: the hero
// highlight stat, the phone group heading and the tier pill. Split out of movements-screen.tsx to
// keep that file under the line cap.
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import Link from "next/link";
import { formatInstantWithDay, type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import {
  movementHealthService,
  stageCopy,
  transportLeg,
  transportNeedState,
} from "@/components/ward-management/ward-derivations";
import { legalStatusFull, legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import { typedTimePhrase } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { standingSuffix, typedTimeStanding } from "@/components/ward-management/legal-forms/legal-forms-view";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { useDueSoonThresholds } from "@/components/ward-management/ward-flow-provider";
import type { WardChipLevel } from "@/components/ward-management/ward-chip";
import { useEffect, useRef } from "react";
import { edById } from "@/components/ward-management/ward-sites";
import { movementOriginLabel } from "@/components/ward-management/ward-movement-origin";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { type MovementLegState } from "./movements-derivations";
import { ArrowRight, Check, ChevronRight, Lock, Scale, X } from "lucide-react";
import { SrOnly, StatusGlyph, TierTile, Timer, buttonClass, cx, useIsPhone, type WfTone } from "@/components/wf";
import { movementNextStep, nextStepTarget, type MovementNextStep } from "./movement-next-step";
import { useSenderPresentation } from "../ward-sender-presentation";
import { movementPresentation } from "../ward-partial-view-presenters";
import flow from "./movement-flow.module.css";
import legalRow from "./movements-stage-row.module.css";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import {
  LEG_STATE_LABEL,
  MS_PER_MINUTE,
  meaningfulBlocker,
  transportRouteLabels,
  movementProgressText,
} from "./movements-screen-helpers";
import { isConstantObservation, observationSummary } from "@/components/ward-management/ward-observation";

/** The ED wait cue's words on a Movements row (P099): wait time, never a form deadline. */
const WAIT_FLAG_WORDS = { soon: "Long wait", over: "Over target" };

export function HighlightStat({
  label,
  value,
  tone,
  pressed,
  onToggle,
}: {
  label: string;
  value: number;
  tone?: WfTone;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    // `data-testid` for D-b/D-f coverage: these whole-network figures must read the same with and
    // without a chosen service. The DOM reads label then value ("Tier 1 18"); CSS draws the number first.
    <button
      type="button"
      className={flow.highlight}
      aria-pressed={pressed}
      onClick={onToggle}
      data-testid="movements-day-metric"
    >
      <span className={flow.highlightFigure}>
        <span className={flow.highlightLabel}>
          {tone && value > 0 ? <StatusGlyph tone={tone} size={9} /> : null}
          {label}
        </span>
        <strong className={flow.highlightValue}>{value}</strong>
      </span>
    </button>
  );
}

/** v10 phone group heading: the caps title left, a bare count right ("21", not "21 people"). */
/**
 * Device audit, 11 Oct 2026: the phone worklist opens as stage headers with their counts, and one
 * tap on a header shows that stage's rows. A marked, opened or jumped-to row stays visible.
 */
export function PhoneGroupHeading({
  id,
  title,
  people,
  open,
  onToggle,
}: {
  id: string;
  title: string;
  people: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={flow.phGroupHead} data-ward-primitive="group-heading">
      <h3 className={flow.phGroupTitle}>
        <button
          type="button"
          className={flow.phGroupToggle}
          aria-expanded={open}
          data-testid={`movements-group-toggle-${id}`}
          onClick={onToggle}
        >
          <ChevronRight size={14} aria-hidden="true" className={flow.phGroupChevron} data-open={open} />
          <span className={flow.phGroupTitleText}>{title}</span>
          <span className={flow.phGroupCount}>
            {people}
            <span className="sr-only"> {people === 1 ? "person" : "people"}</span>
          </span>
        </button>
      </h3>
    </div>
  );
}

/** Urgency tier as a T1 to T3 pill: neutral, never red, with the word "Tier" for screen readers. */
export function TierPill({ tier }: { tier: number }) {
  const isPhone = useIsPhone();
  if (isPhone) return <TierTile tier={tier} data-tier={tier} />;
  return (
    <span className={flow.tier} data-tier={tier}>
      <span className="sr-only">Tier </span>
      <span aria-hidden="true">T</span>
      {tier}
    </span>
  );
}

/**
 * One patient's worklist row (Movements overhaul, option A): tier, patient, route, barrier and
 * legal, time waited and the one next step, on a single line. The whole record lives in the
 * pop-up the name opens; the chevron opens the Patient page. The tier word is kept for screen
 * readers, so every row still carries the same `urgencyTierLabel` every other screen uses.
 */
export function StageRow({
  movement,
  now,
  units,
  referrals = [],
  patients = [],
  accessTargetMinutes,
  reveal,
  consumeReveal,
  onOpenDetail,
  onFocusMovement,
  marked,
  selected,
}: {
  movement: Movement;
  now: Instant;
  units: Unit[];
  referrals?: Referral[];
  patients?: readonly Patient[];
  /** The coordinator-configured ED access target, in minutes — Task 6 of the audit-wiring plan
   *  (2026-09-16). Required, not defaulted: the wait meter must never fall back to a bare 24h. */
  accessTargetMinutes: number;
  reveal: { id: string; request: number } | null;
  consumeReveal: (request: number) => boolean;
  onOpenDetail: (id: string) => void;
  /** Focuses a movement on the coordinator screen, where an escalation is recorded. */
  onFocusMovement: (id: string) => void;
  /** Matched by the search or the hero highlight. Marked rows are tinted, never filtered. */
  marked: boolean;
  selected: boolean;
}) {
  const thresholds = useDueSoonThresholds();
  const sender = useSenderPresentation();
  const presentation = movementPresentation(movement, sender.movementFor(movement));
  const progressText = movementProgressText(presentation);
  const rowRef = useRef<HTMLLIElement>(null);
  const revealRequest = reveal?.id === movement.id ? reveal.request : null;
  useEffect(() => {
    // The screen owns consumption so a later grouping remount cannot replay an old jump.
    if (revealRequest === null || !rowRef.current || !consumeReveal(revealRequest)) return;
    rowRef.current?.focus({ preventScroll: true });
    rowRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }, [revealRequest, consumeReveal]);
  const originEd = edById(movement.originEdId);
  const originLabel = movementOriginLabel(movement, originEd?.name);
  const { destinationLabel } = transportRouteLabels(movement, units);
  const blocker = meaningfulBlocker(movement);
  const healthService = movementHealthService(movement) ?? "Origin service not identified";

  /*
   * A closed movement is MARKED, never filtered (owner ruling 2026-09-05): the recorded outcome as
   * a chip, the recorded reason as its barrier, and a clock frozen at closure.
   */
  const closure = movement.closure;
  const closureState: { level: WardChipLevel; text: string } | null =
    closure === undefined
      ? null
      : closure.outcome === "arrived"
        ? { level: "routine", text: "Arrived" }
        : { level: "cancelled", text: "Did not proceed" };

  const clockEnd = closure ? closure.at : now;
  const patientInfo = resolveSubjectPatient(movement, { patients, referrals });

  // Legal line: register title plus the typed expiry only, as typed. Never a computed limit (D5)
  // and never a countdown (D-93). Its colour comes from the user's warning settings, always with
  // its words ("within 1h", "within 3h", "passed").
  const dueAt = currentLegalDueAt(movement);
  const standing = typedTimeStanding(movement, now, thresholds);
  let legalTagTone: "danger" | "warn" | undefined = undefined;
  let legalText = "";
  // Movements redesign (1 Nov 2026): legal status has its own column. The short status leads
  // ("Form 3B", "Voluntary"); the typed time sits under it as typed, never a countdown (D-93).
  // The full form name is the cell's title.
  const legalShort = legalStatusShort(movement);
  const legalFull = legalStatusFull(movement);
  if (movement.legalForm) {
    if (dueAt === undefined && movement.legalForm.dueAt !== undefined) {
      // Ended at the examination or on arrival: its typed expiry is history, not a deadline (S-6).
      legalText = "Ended";
    } else if (dueAt === undefined) {
      legalText = "No expiry recorded";
    } else {
      if (standing.word) legalTagTone = standing.urgent ? "danger" : "warn";
      legalText = `${typedTimePhrase(dueAt, now)}${standingSuffix(standing)}`;
    }
  } else if (movement.legalStatus !== "Voluntary") {
    legalTagTone = "warn";
    legalText = "No form recorded";
  }

  // Route second line: the transport leg when there is one, otherwise where the bed stands.
  const leg = movement.transport;
  const legState = transportLeg(leg);
  const need = transportNeedState(movement);
  let routeSub = "";
  if (leg && legState) {
    const stateLabel =
      legState === "Requested" ? "Requested" : (LEG_STATE_LABEL[legState as MovementLegState] ?? legState);
    routeSub = `${stateLabel}, ${leg.provider}${leg.escortRequired ? " · escort" : ""}`;
  } else if (movement.acceptedUnitId) {
    routeSub =
      movement.stage === "accepted_awaiting_bed"
        ? "Accepted, bed not pulled"
        : need === "not_needed"
          ? "Bed allocated · no transport needed"
          : need === "needed"
            ? "Bed allocated · no transport booked"
            : "Bed allocated";
  } else if (movement.declines.length > 0) {
    routeSub = `${movement.declines.length} decline${movement.declines.length === 1 ? "" : "s"} recorded${
      movement.escalation ? " · state desk escalated" : ""
    }`;
  } else {
    routeSub =
      movement.referredUnitIds.length > 0
        ? `${movement.referredUnitIds.length} ward${movement.referredUnitIds.length === 1 ? "" : "s"} asked`
        : "No ward asked yet";
  }

  const waitedMinutes = Math.max(clockEnd - movement.openedAt, 0);
  if (progressText && !movement.acceptedUnitId && !leg) routeSub = progressText;
  // ED wait cue, not a form deadline (P099, Josh 27 Oct 2026): "Long wait" from the named ED
  // severe-pressure default, "Over target" past the configured ED access target. No tier-specific
  // window is invented here.
  const waitThresholds = { dueSoon: ED_SEVERE_PRESSURE_WAIT_MINUTES, overdue: accessTargetMinutes };
  const waitTone: "danger" | "warning" | undefined = closure
    ? undefined
    : waitedMinutes >= waitThresholds.overdue
      ? "danger"
      : waitedMinutes >= waitThresholds.dueSoon
        ? "warning"
        : undefined;
  const waitWord = closure
    ? "in journey before it ended"
    : waitTone === "danger"
      ? WAIT_FLAG_WORDS.over
      : waitTone === "warning"
        ? WAIT_FLAG_WORDS.soon
        : "waited";
  const barrierText = closure ? closure.reason : (blocker ?? stageCopy[movement.stage].label);
  const barrierTone: WfTone = closure
    ? "closed"
    : legalTagTone === "danger" || (movement.urgency === 1 && blocker)
      ? "danger"
      : blocker || legalTagTone
        ? "warning"
        : "neutral";
  const detailTitle = [
    healthService,
    `Owner: ${movement.owner.trim() || "Not recorded"}`,
    isConstantObservation(movement.observation) ? observationSummary(movement.observation) : null,
    movement.highAcuity ? "High acuity" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const recordedStep = movementNextStep(movement);
  let step: MovementNextStep | null = presentation.kind === "record" ? recordedStep : null;
  if (presentation.kind === "sender" && presentation.nextStep !== "none") {
    if (recordedStep?.kind === presentation.nextStep) step = recordedStep;
    else if (presentation.nextStep === "wait" || (presentation.nextStep === "pull" && !movement.acceptedUnitId))
      step = { kind: "wait", label: progressText!, owner: "" };
    else
      step = {
        kind: presentation.nextStep,
        label: { refer: "Ask wards", escalate: "Escalate", pull: "Pull the bed" }[presentation.nextStep],
        owner: "Coordinator",
      };
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the row click is a pointer shortcut, and its own button is the keyboard route
    <li
      ref={rowRef}
      tabIndex={-1}
      className={cx(flow.grid, flow.row)}
      data-ward-primitive="record-row"
      data-record-key={movement.id}
      data-revealed={revealRequest !== null ? "true" : undefined}
      data-highlight={marked ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      data-closed={closure ? "true" : undefined}
      data-tone={closure ? "neutral" : movement.urgency === 1 ? "danger" : "neutral"}
      aria-label={`Movement for ${patientInfo.formalName}`}
      onClick={(event) => {
        // The row is a large target for the pointer; the name button is the keyboard route.
        if ((event.target as HTMLElement).closest("a, button, input, select")) return;
        onOpenDetail(movement.id);
      }}
    >
      <span>
        <TierPill tier={movement.urgency} />
        <span className="sr-only">{urgencyTierLabel(movement.urgency)}</span>
      </span>
      <span className={flow.cell} title={detailTitle}>
        <span className={flow.line}>
          {movement.flaggedUrgent ? (
            <span title="Flagged urgent">
              <StatusGlyph tone="danger" size={9} />
              <span className="sr-only">Flagged urgent </span>
            </span>
          ) : null}
          <button
            type="button"
            className={flow.name}
            data-ward-primitive="record-id"
            onClick={() => onOpenDetail(movement.id)}
            aria-label={`What is recorded for ${patientInfo.formalName}`}
          >
            {patientInfo.formalName}
          </button>
          {movement.security === "Secure" ? (
            <Lock size={13} className={flow.lock} aria-label="Needs a locked bed" />
          ) : null}
        </span>
        <span className={flow.sub}>
          <span className="sr-only">UMRN </span>
          <span className={flow.mono}>{patientInfo.umrn}</span> · {movement.cohort}
          {!movement.owner.trim() ? " · No owner" : ""}
        </span>
      </span>
      <span className={flow.cell}>
        <span className={cx(flow.main, flow.route)}>
          <span className={flow.routeFrom} title={originLabel}>
            {originEd ? (
              <>
                <span aria-hidden="true">{`${originEd.siteCode} ED`}</span>
                <SrOnly>{originLabel}</SrOnly>
              </>
            ) : (
              originLabel
            )}
          </span>
          {movement.acceptedUnitId ? (
            <span className={flow.routeTo}>
              <ArrowRight size={12} className={flow.routeArrow} aria-hidden="true" />
              <SrOnly> to </SrOnly>
              <Link
                href={`/ward-flow/board/${movement.acceptedUnitId}`}
                className={flow.wardLink}
                title={`Open ${destinationLabel} Bed Board`}
              >
                {destinationLabel}
              </Link>
            </span>
          ) : (
            <SrOnly>, no destination yet</SrOnly>
          )}
        </span>
        <span className={flow.sub} title={routeSub}>
          {routeSub}
        </span>
      </span>
      <span className={flow.cell}>
        {closureState ? (
          <span className={flow.outcome} data-outcome={closure?.outcome} data-ward-primitive="chip">
            {closure?.outcome === "arrived" ? <Check size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
            {closureState.text}
          </span>
        ) : null}
        <span className={closureState ? flow.sub : flow.barrier} title={barrierText}>
          {closureState ? null : <StatusGlyph tone={barrierTone} size={9} className={flow.barrierGlyph} />}
          <span className="sr-only">{closure ? "Closure note: " : blocker ? "Delay barrier: " : "Stage: "}</span>
          {barrierText}
        </span>
      </span>
      <span className={flow.cell} title={legalFull}>
        <span className={flow.legal}>
          <Scale size={13} className={flow.legalIcon} aria-hidden="true" />
          <span className="sr-only">Legal status: </span>
          {legalShort}
        </span>
        {legalText ? (
          <span className={cx(flow.sub, legalRow.legalLine)} data-tone={legalTagTone}>
            {dueAt !== undefined && legalTagTone ? (
              <StatusGlyph
                tone={legalTagTone === "danger" ? "danger" : "warning"}
                size={9}
                className={legalRow.legalGlyph}
              />
            ) : null}
            {legalText}
            {dueAt !== undefined ? (
              <span className={legalRow.legalTag}>
                {" "}
                <LegalLimitsNotChecked variant="tag" />
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
      <span className={flow.wait}>
        <Timer
          at={movement.openedAt * MS_PER_MINUTE}
          now={clockEnd * MS_PER_MINUTE}
          direction="waiting"
          thresholds={
            closure
              ? undefined
              : { dueSoon: waitThresholds.dueSoon * MS_PER_MINUTE, overdue: waitThresholds.overdue * MS_PER_MINUTE }
          }
          hideFlagWord
          flagWords={WAIT_FLAG_WORDS}
          hideDirection
        />
        {/* Task 6 (2026-09-16): the meter reads the configured ED access target, never 24h. */}
        <span
          className={flow.meter}
          data-tone={waitTone}
          aria-hidden="true"
          title={`${splitDuration(waitedMinutes)} of ${splitDuration(accessTargetMinutes)}`}
        >
          <i style={{ width: `${Math.min(100, (waitedMinutes / accessTargetMinutes) * 100).toFixed(0)}%` }} />
        </span>
        <span className="sr-only">{waitWord}</span>
      </span>
      <span className={flow.next}>
        {presentation.kind === "unavailable" ? (
          <span className={flow.nextOwner}>{progressText}</span>
        ) : step === null ? (
          <span className={flow.nextOwner}>{closure ? formatInstantWithDay(closure.at, now) : ""}</span>
        ) : step.kind !== "wait" ? (
          <Link
            className={buttonClass({ variant: "sec", size: "sm" })}
            href={nextStepTarget(step, movement.id).href}
            title={`${step.label} on ${nextStepTarget(step, movement.id).where}`}
            onClick={step.kind === "escalate" ? () => onFocusMovement(movement.id) : undefined}
          >
            {step.label}
          </Link>
        ) : (
          <>
            <span className={flow.nextLabel}>{step.label}</span>
            <span className={flow.nextOwner}>{step.owner}</span>
          </>
        )}
      </span>
      <Link
        className={buttonClass({ variant: "ghost", size: "sm", iconOnly: true, className: flow.review })}
        href={movementHref(movement.id)}
        aria-label={`Review patient ${patientInfo.formalName}`}
        title="Open the Patient page"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </Link>
    </li>
  );
}
