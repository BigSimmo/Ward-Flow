"use client";
// Referrals redesign, round 4 (Josh, 31 October 2026): the right-hand patient panel's new parts.
// LiveDecisionClock is a fork of DecisionClock in
// src/components/ward-management/referrals/referral-board-parts.tsx. Changed: a pulsing live dot
// and the clock time say the wait is still counting, the bar is green, amber then red, and a "due"
// tick marks the end of the tier's window. PanelNav replaces the panel's footer row (Summary, Next)
// with one compact row under the header: previous and next with "n of N", then Summary and Patient.

import Link from "next/link";
import {
  BedDouble,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  ListOrdered,
  Lock,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import { formatInstantWithDay, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import { referralClocks } from "@/components/ward-management/ward-referrals";
import {
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";
import { isOverdue, wardArm, type BedsReadySummary } from "@/components/ward-management/referrals/referral-board-parts";
import { demographicLabel } from "@/components/ward-management/referrals/referral-board-model";
import { ReferralWorkedOn } from "@/components/ward-management/referrals/referral-worked-on-note";
import { useSenderPresentation } from "@/components/ward-management/ward-sender-presentation";
import { referralPresentation } from "@/components/ward-management/ward-partial-view-presenters";
import { Button, buttonClass, cx, durMinutes } from "@/components/wf";

import s from "./referral-panel.module.css";

/** The tier's own window, or the any-tier one if that is shorter (Josh's defaults, not legal limits). */
function decisionWindow(referral: Referral): number {
  return Math.min(OVERDUE_AFTER_MINUTES_BY_TIER[referral.urgency], OVERDUE_AFTER_ANY_TIER_MINUTES);
}

/** Review fix 8: "3 days ago" rather than "07:42, 3 days ago"; today keeps its clock time. */
function shortWhen(at: Instant, now: Instant): string {
  const words = formatInstantWithDay(at, now);
  const comma = words.indexOf(", ");
  return comma === -1 ? words : words.slice(comma + 2);
}

function clockTime(now: Instant): string {
  const minutes = minuteOfDay(now);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** A small pulsing dot: the time beside it is still counting. Still under reduced motion. */
export function LiveDot({ tone = "success" }: { tone?: "success" | "warning" | "danger" | "neutral" }) {
  return <span className={s.liveDot} data-tone={tone} aria-hidden="true" />;
}

export function LiveDecisionClock({ referral, now }: { referral: Referral; now: Instant }) {
  const sender = useSenderPresentation();
  const summary = sender.referralFor(referral);
  const presentation = referralPresentation(referral, summary);
  if (presentation.kind === "unavailable") return <p role="status">Referral progress unavailable.</p>;
  const settled = summary !== undefined && (presentation.state !== "queued" || presentation.withdrawn);
  const base = referralClocks(
    referral,
    settled ? (presentation.decidedAt ?? referral.triagedAt ?? referral.raisedAt) : now,
  );
  const running = base.sinceReferralRunning && !settled;
  const window = decisionWindow(referral);
  const dueAt = referral.raisedAt + window;
  const overdue = isOverdue(referral, now);
  // The bar is drawn against the window plus a quarter, so the due tick sits inside it and an
  // overdue wait visibly runs past it.
  const scale = window * 1.25;
  const used = Math.min(100, Math.round((base.sinceReferral / scale) * 100));
  const share = Math.round((base.sinceReferral / window) * 100);
  const near = running && !overdue && share >= 75;
  const tone = !running ? "neutral" : overdue ? "danger" : near ? "warning" : "success";
  return (
    <div
      className={s.clock}
      data-tone={tone}
      data-testid={`ward-referral-clock-${referral.id}`}
      title={`Sent ${formatInstantWithDay(referral.raisedAt, now)}. Tier ${referral.urgency} decision window ${durMinutes(window)}.`}
    >
      <div className={s.clockTop}>
        <span className={s.clockWait}>
          {running ? <LiveDot tone={tone} /> : null}
          <b className={s.mono}>{durMinutes(base.sinceReferral)}</b> waiting
        </span>
        <span className={s.clockLeft}>
          {!running ? (
            "Clock stopped at triage"
          ) : overdue ? (
            <>
              <TriangleAlert size={13} aria-hidden="true" />
              <b className={s.mono}>{durMinutes(now - dueAt)}</b> overdue
            </>
          ) : (
            <>
              <b className={s.mono}>{durMinutes(dueAt - now)}</b> left
            </>
          )}
        </span>
      </div>
      <div
        className={s.clockTrack}
        role="img"
        aria-label={`${Math.min(share, 999)}% of the tier ${referral.urgency} decision window used`}
      >
        <i style={{ width: `${used}%` }} />
        <span className={s.clockDue} style={{ left: `${Math.round((window / scale) * 100)}%` }} />
      </div>
      <div className={s.clockFoot}>
        <span>
          Sent <span className={s.mono}>{shortWhen(referral.raisedAt, now)}</span>
        </span>
        <span>
          {running ? (
            <>
              Live · <span className={s.mono}>{clockTime(now)}</span>
            </>
          ) : null}
        </span>
        <span>
          Due <span className={s.mono}>{shortWhen(dueAt, now)}</span>
        </span>
      </div>
      {/* Smart features idea 3: who has this in hand. A courtesy note; the clock keeps running. */}
      <ReferralWorkedOn referral={referral} />
    </div>
  );
}

/** One compact row under the header: previous, "n of N", next, then Summary and the patient record. */
export function PanelNav({
  position,
  total,
  onPrevious,
  onNext,
  onSummary,
  patientHref,
}: {
  position: number | undefined;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onSummary: () => void;
  patientHref?: string;
}) {
  return (
    <div className={s.nav}>
      <div className={s.navStep} role="group" aria-label="Move through the queue">
        <button
          type="button"
          className={s.navIcon}
          onClick={onPrevious}
          aria-label="Previous referral (K)"
          title="Previous (K)"
          disabled={total < 2}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className={s.navCount}>{position === undefined ? `${total} in queue` : `${position} of ${total}`}</span>
        <button
          type="button"
          className={s.navIcon}
          onClick={onNext}
          aria-label="Next referral (J)"
          title="Next (J)"
          disabled={total < 2}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <span className={s.navSpacer} />
      <button
        type="button"
        className={buttonClass({ variant: "ghost", size: "sm" })}
        onClick={onSummary}
        title="Referral summary (S)"
      >
        <FileText size={14} aria-hidden="true" />
        Summary
      </button>
      {patientHref ? (
        <Link
          href={patientHref}
          className={cx(buttonClass({ variant: "ghost", size: "sm" }))}
          data-testid="ward-referral-open-patient"
        >
          <UserRound size={14} aria-hidden="true" />
          Patient
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Fork of HeroTools (referral-board-parts.tsx). Changed: Bed meeting list carries the number of
 * people it will list, which follows the header's service and any highlight.
 */
export function HeroTools({
  overdueCount,
  meetingCount,
  onNextOverdue,
  onMeeting,
}: {
  overdueCount: number;
  meetingCount: number;
  onNextOverdue: () => void;
  onMeeting: () => void;
}) {
  return (
    <div className={s.heroTools}>
      <Button
        variant="onHero"
        size="sm"
        icon={TriangleAlert}
        count={overdueCount > 0 ? overdueCount : undefined}
        disabledReason={overdueCount > 0 ? undefined : "Nothing is overdue."}
        reasonDisplay="tooltip"
        onClick={onNextOverdue}
        data-testid="ward-referral-next-overdue"
      >
        Next overdue
      </Button>
      <Button
        variant="onHero"
        size="sm"
        icon={ListOrdered}
        count={meetingCount}
        onClick={onMeeting}
        title="Bed meeting list (M)"
        data-testid="ward-referral-meeting"
      >
        Bed meeting list
      </Button>
    </div>
  );
}

/**
 * Review fix 6 (31 Oct 2026): the line under a name. A referral that asks for no ward bed has no
 * recorded sex cell, which printed "not a ward referral" beside the age; Asking for already says it.
 */
export function personLine(referral: Referral): string {
  return wardArm(referral) ? demographicLabel(referral) : referral.ageBand;
}

/**
 * Review fix 1 and 2 (Josh, 31 Oct 2026): beds ready as one slim "at a glance" line under the
 * runway, the approved Waiting header strip, in place of the tall two-row block. Cohorts add up to
 * the total; locked is a part of them, so it sits after a divider with its own icon.
 */
export function BedsStrip({ summary }: { summary: BedsReadySummary }) {
  const cohorts = summary.cells.filter((cell) => cell.label !== "Locked");
  const locked = summary.cells.find((cell) => cell.label === "Locked")?.value ?? 0;
  return (
    <div className={s.bedsStrip} data-testid="ward-referral-beds-ready">
      <Link
        href="/ward-flow/hub"
        className={s.bedsLead}
        title="Beds ready statewide for your desk's admissions. Open Places"
      >
        <BedDouble size={14} aria-hidden="true" />
        <b>{summary.total}</b> beds ready
      </Link>
      {cohorts.map((cell) => (
        <span key={cell.label} className={s.bedsItem}>
          {cell.label} <b>{cell.value}</b>
        </span>
      ))}
      <span className={s.bedsItem} aria-label={`${locked} of these beds are locked`}>
        <Lock size={13} aria-hidden="true" />
        <b>{locked}</b> locked
      </span>
      {summary.preparing > 0 ? (
        <span className={s.bedsItem} data-tone="warning" data-testid="ward-referral-beds-preparing">
          <b>{summary.preparing}</b> being made ready
        </span>
      ) : null}
      {summary.oldestUpdateMinutes !== undefined ? (
        <span className={s.bedsItem} title="Oldest ward bed confirmation">
          <Clock3 size={13} aria-hidden="true" />
          updated <b>{durMinutes(summary.oldestUpdateMinutes)}</b> ago
        </span>
      ) : null}
    </div>
  );
}
