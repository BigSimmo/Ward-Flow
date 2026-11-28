"use client";
// Referrals redesign, round 4 (Josh, 31 October 2026): the right-hand patient panel's new parts.
// LiveDecisionClock is a fork of DecisionClock in
// src/components/ward-management/referrals/referral-board-parts.tsx. Changed: a pulsing live dot
// and the clock time say the wait is still counting, the bar is green, amber then red, and a "due"
// tick marks the end of the tier's window. The drawer head carries the pager; it replaced the panel's footer row (Summary, Next)
// with one compact row under the header: previous and next with "n of N", then Summary and Patient.

import Link from "next/link";
import { BedSingle, Clock3, Lock, TriangleAlert } from "lucide-react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import { referralClocks } from "@/components/ward-management/ward-referrals";
import {
  OVERDUE_AFTER_ANY_TIER_MINUTES,
  OVERDUE_AFTER_MINUTES_BY_TIER,
} from "@/components/ward-management/ward-operational-defaults";
import { isOverdue, wardArm, type BedsReadySummary } from "./referral-board-parts";
import { demographicLabel } from "./referral-board-model";
import { ReferralWorkedOn } from "./referral-worked-on-note";
import { useSenderPresentation } from "@/components/ward-management/ward-sender-presentation";
import { referralPresentation } from "@/components/ward-management/ward-partial-view-presenters";
import { Button, StatusGlyph, durMinutes } from "@/components/wf";

import s from "./referral-panel.module.css";

/** The tier's own window, or the any-tier one if that is shorter (Josh's defaults, not legal limits). */
function decisionWindow(referral: Referral): number {
  return Math.min(OVERDUE_AFTER_MINUTES_BY_TIER[referral.urgency], OVERDUE_AFTER_ANY_TIER_MINUTES);
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
              <StatusGlyph tone="danger" size={12} />
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
      {/* Audit three #8: waiting and overdue are said once, on the bar. The sent time is in the
          title and the Timeline tab. */}
      {/* Smart features idea 3: who has this in hand. A courtesy note; the clock keeps running. */}
      <ReferralWorkedOn referral={referral} />
    </div>
  );
}

/**
 * Fork of HeroTools (referral-board-parts.tsx). MU1 (Josh, 5 Nov 2026): Next overdue is the hero's one
 * button. Simplification 26 Nov 2026 (Referrals plan): the bed meeting agenda is a quick-link chip
 * again, first in the chip row (`MeetingPill`), as on the coordinator's top.
 */
export function HeroTools({ overdueCount, onNextOverdue }: { overdueCount: number; onNextOverdue: () => void }) {
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
        href="/bedchart/hub"
        className={s.bedsLead}
        title="Beds ready statewide for your desk's admissions. Open Places"
      >
        <BedSingle size={14} aria-hidden="true" />
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
