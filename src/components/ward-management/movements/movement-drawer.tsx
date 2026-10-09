"use client";

import { useState } from "react";
import Link from "next/link";
import { BedSingle, ChevronRight, Flag, Lock, PhoneCall, ShieldCheck, Truck, X } from "lucide-react";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import {
  isOpen,
  movementHealthService,
  referralForMovement,
  stageCopy,
  transportLeg,
  transportNeedState,
} from "@/components/ward-management/ward-derivations";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { patientDisplayName, type Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { departmentLabel, wardLabel } from "@/components/ward-management/ward-absence-labels";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import {
  URGENT_MARK_REASONS,
  changeReasonLabels,
  type UrgentMarkReason,
} from "@/components/ward-management/ward-change-reasons";
import { BLOCKERS_MEANING_NOTHING_IS_BLOCKING } from "@/components/ward-management/ward-model";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { StatusGlyph, buttonClass, type WfTone } from "@/components/wf";

import { movementNextStep } from "./movement-next-step";
import d from "./movement-drawer.module.css";

/**
 * Review fix-forward item 10 (2026-09-17): an `aria-disabled` button with no further explanation
 * tells an assistive-technology reader the button exists and nothing about why it does not respond.
 */
const URGENT_FLAG_UNCHOSEN = "Choose why this patient is being flagged urgent first.";

/** D4: the exact words for a control this prototype shows but does not connect. */
const NOT_WIRED = "Not wired in this prototype.";

/**
 * **The patient pop-up (Movements overhaul, option A, 9 Oct 2026).** Opened from a worklist row,
 * a timeline bar or a Needs you item. It answers four questions in order, from fields the record
 * holds and nothing else: where the patient is in the journey and how long they have waited
 * against the configured ED access target, the route and transport leg, the legal authority with
 * its RECORDED expiry only (D5), and the one next step with who owns it.
 *
 * **It records one thing itself, the urgent flag** (M7, owner ruling 2026-09-12: Chase the ward,
 * Add to a shortlist and Record an override were declined). Pull bed, Refer and Escalate open
 * the Patient page, where those forms and the pull's gate checks and override reason already live. Every other step belongs to
 * ED, the receiving ward or transport, so the pop-up names the owner and offers nothing it is not
 * allowed to record. Call ward desk is Preview: there is no ward desk number in the model.
 *
 * The record sections below keep the five the drawing ships (Person, Journey, Which wards were
 * asked, Escalation, Transport leg). *Watch and flag* is still not built and is named in the foot,
 * because nothing records that somebody is watching a movement.
 */

/**
 * 🔴 **THE PERSON SECTION NAMES THE PATIENT — OWNER RULING O-16.3, 2026-09-11: *"Yes show the
 * patient name."*** **It did not, until he ruled.**
 *
 * **What happened, because the sequence is the point:** the drawer originally read
 * `Referral.patientId` and `tests/ward-patient-link-default-deny.test.ts` refused it — *"a ward
 * learning where else a patient has been is exactly what this guard exists to stop. Hand this back
 * to Ward Lead rather than deciding it is fine and widening the allowlist yourself."* ✅ **The read
 * was removed, the conflict was put to the owner, and he decided.** 🔴 **The allowlist entry exists
 * because he overruled the recommendation to keep it denied — not because the guard was found
 * inconvenient.**
 *
 * **So ruling ② — a coordinator sees who the patient is wherever they are SELECTING or ACTING ON
 * that person — wins over D-14's default-deny ON THIS SCREEN, and on no other by implication.**
 *
 * ⚠️ **THE GRANULARITY IS THE BOUND THAT KEEPS THIS COMPATIBLE WITH FD-23:** one movement's OWN
 * linked referral and the person it names. **Never a list of a person's referrals, never where else
 * they have been referred, never a count.** FD-23 protects disclosure of WHERE; this discloses no
 * place, no ward and no other episode.
 *
 * 🔴 **AND THIS IS NOT GRANDFATHERED PAST THE SEED. EVERY PATIENT IN THIS APP TODAY IS INVENTED.**
 * ⚠️ **The moment real data reaches it, rendering a name on a coordinator's board is a live privacy
 * decision that needs its own review. This ruling was made about synthetic data and says nothing
 * about real data.** **It will stop being obvious that these are not real people, and this comment
 * is where somebody should find that out.**
 *
 * **The three absences stay, and they are still three different facts.** A movement with no
 * referral, a referral that names nobody, and a referral naming somebody this system does not hold
 * are not the same situation, and a coordinator can act on the difference. **None is a blank and
 * none is the word "unknown".**
 *
 * ⚠️ **Measured on this seed: 24 referrals, 2 carrying a `patientId`, 2 movements carrying a
 * `referralId`, 0 reaching a person** — the two linked referrals are not the two pointed at. **So
 * the NAMED branch is unreachable from the seed and is tested with a hand-built fixture;
 * `RAISE_REFERRAL` links one raised live, so it is unreachable-from-the-seed, not dead.**
 */
export function personLine(movement: Movement, referrals: Referral[], patients: readonly Patient[]): string {
  const referral = referralForMovement(movement, referrals);
  if (referral === undefined) {
    return "No referral is recorded against this movement, so there is no person to name.";
  }
  if (referral.patientId === undefined) {
    return `Referral ${referral.id} raised this movement and names no person, so nobody can be identified from it.`;
  }
  const patient = patients.find((candidate) => candidate.id === referral.patientId);
  if (patient === undefined) {
    return `Referral ${referral.id} names ${referral.patientId}, and this system holds no record under that.`;
  }
  return patient.umrn ? `${patientDisplayName(patient)} · UMRN: ${patient.umrn}` : patientDisplayName(patient);
}

/** The six steps a coordinator reads, in order. Arrival is the end of the track, not a step. */
const STEPS: { stage: Movement["stage"]; label: string }[] = [
  { stage: "placement_requested", label: "Referred" },
  { stage: "destination_review", label: "Review" },
  { stage: "accepted_awaiting_bed", label: "Accepted" },
  { stage: "pulled", label: "Pulled" },
  { stage: "handover_ready", label: "Handover" },
  { stage: "moving", label: "Moving" },
];

const LEG_WORD: Record<string, string> = {
  Requested: "Requested",
  Accepted: "Booked",
  "En route": "En route",
  Collected: "Collected",
  Arrived: "Arrived",
  Cancelled: "Cancelled",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={d.section}>
      <h3 className={d.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

export function MovementDrawer({
  movement,
  now,
  units,
  referrals,
  patients,
  edAccessTargetMinutes,
  dispatch,
  onClose,
}: {
  movement: Movement | undefined;
  now: Instant;
  /** Threaded from the screen for the same reason `units` is — one provider reader per screen. */
  referrals: Referral[];
  patients: readonly Patient[];
  /**
   * The LIVE units, threaded from the screen rather than read from the fixture, so the pop-up and
   * the board behind it name a ward from the same reducer state.
   */
  units: Unit[];
  /**
   * Coordinator-configured ED access target, threaded from the screen's `configuration` rather
   * than the module default (`tests/ward-configuration-read-sites.test.ts`).
   */
  edAccessTargetMinutes: number;
  /** The same store the board behind this pop-up reads from. */
  dispatch: (event: WardFlowEvent) => void;
  onClose: () => void;
}) {
  // Item 37 (2026-09-17): the flag needs a reason chosen from URGENT_MARK_REASONS. Declared before
  // the early return so hook order never depends on whether `movement` resolves.
  const [urgentFlagReason, setUrgentFlagReason] = useState<UrgentMarkReason | undefined>(undefined);

  if (movement === undefined) return null;

  const open = isOpen(movement);
  const closure = movement.closure;
  const originEd = edById(movement.originEdId);
  const originLabel = departmentLabel(movement.originEdId, originEd?.name);
  const originSite = originEd?.siteCode ? siteByCode(originEd.siteCode) : undefined;
  const accepted =
    movement.acceptedUnitId === undefined
      ? undefined
      : units.find((candidate) => candidate.id === movement.acceptedUnitId);
  const acceptedSite = accepted ? siteByCode(accepted.siteCode)?.name : undefined;
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number. D-39: the UMRN.
  const subject = resolveSubjectPatient(movement, { patients, referrals });
  const titleId = `ward-movement-drawer-title-${movement.id}`;
  const recordHref = `/mockups/ward-flow/movements/${movement.id}`;

  const step = movementNextStep(movement);
  const blocker = movement.blocker.trim();
  const hasBlocker = blocker !== "" && !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === blocker);

  // Wait against the configured access target, with the named 8 hour severe-pressure mark.
  const waited = Math.max((closure ? closure.at : now) - movement.openedAt, 0);
  const waitTone: "danger" | "warning" | undefined = closure
    ? undefined
    : waited >= edAccessTargetMinutes
      ? "danger"
      : waited >= ED_SEVERE_PRESSURE_WAIT_MINUTES
        ? "warning"
        : undefined;
  const waitWord = closure
    ? "in journey before it ended"
    : waitTone === "danger"
      ? `past the ${splitDuration(edAccessTargetMinutes)} target`
      : waitTone === "warning"
        ? `over ${splitDuration(ED_SEVERE_PRESSURE_WAIT_MINUTES)}`
        : "waited";
  const severeMark = Math.min(100, (ED_SEVERE_PRESSURE_WAIT_MINUTES / edAccessTargetMinutes) * 100);

  // Transport: the leg's latest recorded step and when.
  const leg = movement.transport;
  const legState = transportLeg(leg);
  // The time of the step the derived state names: a cancel or an arrival, not the step before it.
  const legAt = leg
    ? (leg.cancelledAt ?? leg.arrivedAt ?? leg.collectedAt ?? leg.enRouteAt ?? leg.acceptedAt)
    : undefined;
  const need = transportNeedState(movement);
  const via = leg
    ? `${leg.provider}${leg.escortRequired ? " · escort required" : " · no escort"}`
    : need === "not_needed"
      ? "No transport needed"
      : movement.stage === "handover_ready"
        ? "Transport not booked"
        : "Transport not recorded";

  // Legal: the register title plus the recorded expiry only. Never a computed limit (D5).
  const dueAt = movement.legalForm?.dueAt;
  const legalTone: WfTone | undefined =
    dueAt === undefined || closure ? undefined : dueAt < now ? "danger" : dueAt - now < 60 ? "warning" : undefined;
  const legalTitle = movement.legalForm
    ? legalFormName(movement.legalForm)
    : movement.legalStatus === "Voluntary"
      ? "Voluntary"
      : "No legal form recorded";
  const legalWhen =
    dueAt === undefined
      ? movement.legalForm
        ? "no recorded expiry"
        : ""
      : dueAt < now
        ? `recorded expiry passed ${splitDuration(now - dueAt)} ago`
        : `recorded expiry ${formatInstantWithDay(dueAt, now)}`;

  const declined = movement.declines.length;
  const asked = movement.referredUnitIds.length;
  const wardsAsked = accepted
    ? asked === 0
      ? "Accepted"
      : `${asked}, accepted`
    : asked === 0
      ? "None yet"
      : declined >= asked
        ? `${asked}, all declined`
        : `${asked}, ${declined} declined`;

  // Only an arrival completes the track. A movement that did not proceed keeps the stage it held.
  const currentStep =
    closure?.outcome === "arrived" || movement.stage === "arrived"
      ? STEPS.length
      : STEPS.findIndex((s) => s.stage === movement.stage);

  let nextAction: React.ReactNode = null;
  if (step && open) {
    if (step.kind !== "wait") {
      nextAction = (
        <Link className={buttonClass({ variant: "pri", className: d.wide })} href={recordHref}>
          {step.label} on the Patient page
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      );
    } else {
      nextAction = (
        <p className={d.waiting}>
          <StatusGlyph tone="neutral" size={9} />
          <span>
            Next: <strong>{step.label}</strong>, waiting on {step.owner}
          </span>
        </p>
      );
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      labelledBy={titleId}
      placement="responsive-right"
      contentClassName={d.panel}
      bodyClassName={d.body}
    >
      <div className={d.head} data-closed={closure ? "true" : undefined}>
        <div className={d.who}>
          <h2 id={titleId} className={d.name}>
            {subject.formalName} <span className="sr-only">— what is recorded</span>
          </h2>
          <p className={d.subline}>
            <span className={d.mono}>{subject.umrn}</span>
            <span className={d.trunc}>
              {" "}
              · {movement.cohort} · {movement.sex}
            </span>
            {movement.security === "Secure" ? (
              <Lock size={13} className={d.lock} aria-label="Needs a locked bed" />
            ) : null}
          </p>
        </div>
        <span className={d.tier} data-tier={movement.urgency} title={`Urgency tier ${movement.urgency}`}>
          <span className="sr-only">Urgency tier </span>
          <span aria-hidden="true">T</span>
          {movement.urgency}
        </span>
        <Link className={buttonClass({ variant: "ghost", size: "sm" })} href={recordHref} title="Open the Patient page">
          <span className={d.linkText}>Patient</span>
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
        <button
          type="button"
          className={buttonClass({ variant: "sec", size: "sm", iconOnly: true })}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {closure ? (
        <p className={d.closed}>
          <StatusGlyph tone={closure.outcome === "arrived" ? "success" : "closed"} size={9} />
          <span className={d.trunc}>
            {closure.outcome === "arrived" ? "Arrived" : "Did not proceed"} {formatInstantWithDay(closure.at, now)} ·{" "}
            {closure.reason}
          </span>
        </p>
      ) : (
        <div className={d.status}>
          <p className={d.statusLine}>
            <StatusGlyph tone={movement.flaggedUrgent ? "danger" : "neutral"} size={9} />
            <strong>{stageCopy[movement.stage].label}</strong>
            {legState && legAt !== undefined ? (
              <span className={d.trunc}>
                · {LEG_WORD[legState] ?? legState} <span className={d.mono}>{formatInstantWithDay(legAt, now)}</span>
              </span>
            ) : null}
            <span className={d.spacer} />
            {waitTone ? <StatusGlyph tone={waitTone} size={9} /> : null}
            <span className={d.waitValue}>{splitDuration(waited)}</span>
            <span className={d.waitWord} data-tone={waitTone}>
              {waitWord}
            </span>
          </p>
          <span className={d.meter} data-tone={waitTone} aria-hidden="true">
            <i style={{ width: `${Math.min(100, (waited / edAccessTargetMinutes) * 100).toFixed(0)}%` }} />
            <b style={{ left: `${severeMark.toFixed(1)}%` }} />
          </span>
          <span className={d.ticks} aria-hidden="true">
            <span>Opened {formatInstantWithDay(movement.openedAt, now)}</span>
            <span>{splitDuration(edAccessTargetMinutes)} target</span>
          </span>
        </div>
      )}

      <ol className={d.journeySteps} aria-label="Journey stage">
        {STEPS.map((s, index) => (
          <li
            key={s.stage}
            className={d.journeyStep}
            data-state={index < currentStep ? "done" : index === currentStep ? "current" : undefined}
            aria-current={index === currentStep ? "step" : undefined}
          >
            <span className={d.dot} aria-hidden="true" />
            <span className={d.stepLabel}>{s.label}</span>
          </li>
        ))}
      </ol>

      <div className={d.route}>
        <StatusGlyph tone="neutral" size={9} />
        <span className={d.place} title={originLabel}>
          {originEd ? `${originEd.siteCode} ED` : originLabel}
          {originSite ? <small>{originSite.name}</small> : null}
        </span>
        <span className={d.time}>{formatInstantWithDay(movement.openedAt, now)}</span>
        <span className={d.line} aria-hidden="true" />
        <span className={d.via}>
          <Truck size={14} aria-hidden="true" />
          <span className={d.trunc}>{via}</span>
        </span>
        <StatusGlyph tone={accepted ? "info" : "closed"} size={9} />
        <span className={d.place}>
          {accepted ? accepted.name : "Destination pending"}
          {acceptedSite ? <small>{acceptedSite}</small> : null}
        </span>
        <span className={d.time}>{closure ? formatInstantWithDay(closure.at, now) : ""}</span>
      </div>

      <div className={d.facts}>
        <p className={d.legal} data-tone={legalTone}>
          {legalTone ? <StatusGlyph tone={legalTone} size={9} /> : <ShieldCheck size={14} aria-hidden="true" />}
          <span className={d.trunc}>
            <strong>{legalTitle}</strong>
            {legalWhen ? ` · ${legalWhen}` : ""}
          </span>
        </p>
        <dl className={d.grid}>
          <div>
            <dt>Whose move</dt>
            <dd>{step ? step.owner : "Nobody, closed"}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{movement.owner.trim() || "Not recorded"}</dd>
          </div>
          <div>
            <dt>Transport</dt>
            <dd>
              {legState && legAt !== undefined
                ? `${LEG_WORD[legState] ?? legState} ${formatInstantWithDay(legAt, now)}`
                : legState
                  ? (LEG_WORD[legState] ?? legState)
                  : "Not recorded"}
            </dd>
          </div>
          <div>
            <dt>CAD</dt>
            <dd className={d.mono}>{leg?.cadNumber ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Wards asked</dt>
            <dd>{wardsAsked}</dd>
          </div>
          <div>
            <dt>Service</dt>
            <dd>{movementHealthService(movement) ?? "Not identified"}</dd>
          </div>
        </dl>
        {hasBlocker && !closure ? (
          <p className={d.blocker}>
            <StatusGlyph tone={waitTone === "danger" ? "danger" : "warning"} size={9} />
            <span className={d.trunc} title={movement.blocker}>
              {movement.blocker}
            </span>
          </p>
        ) : null}
      </div>

      <section className={d.actions} aria-labelledby={`${titleId}-actions`}>
        <h3 id={`${titleId}-actions`} className={d.sectionTitle}>
          What you can do
        </h3>
        {nextAction}
        <div className={d.row}>
          {accepted ? (
            <Link
              href={`/mockups/ward-flow/board/${accepted.id}`}
              className={buttonClass({ variant: "sec", size: "sm" })}
              title={`Open ${accepted.name} Bed Board`}
            >
              <BedSingle size={14} aria-hidden="true" />
              Ward board
            </Link>
          ) : null}
          <button
            type="button"
            className={buttonClass({ variant: "sec", size: "sm", className: d.preview })}
            aria-disabled="true"
            title={`Preview. ${NOT_WIRED}`}
            onClick={ignoreUnavailableActivation}
          >
            <PhoneCall size={14} aria-hidden="true" />
            Call ward desk
          </button>
        </div>
        <div className={d.urgent}>
          <p className={d.urgentLine}>
            <Flag size={14} aria-hidden="true" />
            <span>
              {movement.flaggedUrgent
                ? open
                  ? "Flagged urgent. This patient leads the queue ahead of every urgency tier, including tier 1."
                  : "Flagged urgent. This movement is no longer in the queue, so the flag orders nothing now. Removing it changes only the record."
                : open
                  ? "Not flagged. This patient is ordered by urgency tier and waiting time, like everybody else."
                  : "Not flagged, and this movement is no longer running, so it is not in the queue at all. Flagging it would change nothing."}
            </span>
          </p>
          {movement.flaggedUrgent ? (
            <button
              type="button"
              className={buttonClass({ variant: "sec", size: "sm" })}
              data-testid="ward-movement-drawer-urgent-toggle"
              onClick={() =>
                dispatch({ type: "CLEAR_MOVEMENT_URGENT_FLAG", role: "coordinator", now, movementId: movement.id })
              }
            >
              Remove the urgent flag
            </button>
          ) : open ? (
            <div className={d.urgentPick}>
              <label className="sr-only" htmlFor="ward-movement-drawer-urgent-reason">
                Why is this urgent?
              </label>
              <select
                id="ward-movement-drawer-urgent-reason"
                className={d.select}
                data-testid="ward-movement-drawer-urgent-reason"
                value={urgentFlagReason ?? ""}
                onChange={(chosen) => {
                  const value = chosen.target.value;
                  setUrgentFlagReason(
                    URGENT_MARK_REASONS.includes(value as UrgentMarkReason) ? (value as UrgentMarkReason) : undefined,
                  );
                }}
              >
                <option value="">Choose why this is urgent</option>
                {URGENT_MARK_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {changeReasonLabels[reason]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={buttonClass({ variant: "sec", size: "sm" })}
                data-testid="ward-movement-drawer-urgent-toggle"
                aria-disabled={urgentFlagReason === undefined ? "true" : undefined}
                aria-describedby={urgentFlagReason === undefined ? "ward-movement-drawer-urgent-blocked" : undefined}
                title={urgentFlagReason === undefined ? URGENT_FLAG_UNCHOSEN : undefined}
                onClick={
                  urgentFlagReason === undefined
                    ? ignoreUnavailableActivation
                    : () => {
                        dispatch({
                          type: "FLAG_MOVEMENT_URGENT",
                          role: "coordinator",
                          now,
                          movementId: movement.id,
                          reason: urgentFlagReason,
                        });
                        setUrgentFlagReason(undefined);
                      }
                }
              >
                Flag this patient as urgent
              </button>
              {urgentFlagReason === undefined ? (
                <span id="ward-movement-drawer-urgent-blocked" className="sr-only">
                  {URGENT_FLAG_UNCHOSEN}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <div className={d.record}>
        <Section title="Person">
          <p className={d.text}>{personLine(movement, referrals, patients)}</p>
          <p className={d.muted}>
            Sex recorded as {movement.sex} · {movement.cohort} ·{" "}
            {movement.security === "Secure" ? "needs a locked bed" : "open ward"} · urgency {movement.urgency} of 3
          </p>
        </Section>

        <Section title="Journey">
          {movement.stageChanges.length === 0 ? (
            <p className={d.muted}>
              No stage change has been recorded, so this movement has not moved since it opened.
            </p>
          ) : (
            <ul className={d.list}>
              {[...movement.stageChanges].reverse().map((change) => (
                <li key={`${change.at} ${change.to}`}>
                  <span className={d.mono}>{formatInstantWithDay(change.at, now)}</span>
                  <span className={d.trunc}>
                    {change.from === undefined ? "Opened" : stageCopy[change.from].label} to{" "}
                    {stageCopy[change.to].label}
                    {` · ${change.by}`}
                    {change.reason === undefined ? "" : ` · ${change.reason}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Which wards were asked">
          {movement.referredUnitIds.length === 0 ? (
            <p className={d.muted}>No ward has been asked yet.</p>
          ) : (
            <ul className={d.list}>
              {movement.referredUnitIds.map((unitId) => {
                const unit = units.find((candidate) => candidate.id === unitId);
                const decline = movement.declines.find((entry) => entry.unitId === unitId);
                const answer =
                  movement.acceptedUnitId === unitId
                    ? "Accepted"
                    : decline
                      ? `Declined, ${decline.reason}`
                      : "No answer yet";
                return (
                  <li key={unitId}>
                    <StatusGlyph
                      tone={movement.acceptedUnitId === unitId ? "success" : decline ? "closed" : "neutral"}
                      size={9}
                    />
                    <span className={d.trunc}>
                      <strong>{wardLabel(unitId, unit?.name)}</strong> · {answer}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Escalation">
          {movement.escalation === undefined ? (
            <p className={d.muted}>Nothing has been escalated on this movement. That is a record, not a gap.</p>
          ) : (
            <p className={d.text}>
              Escalated to {movement.escalation.contact} on {formatInstantWithDay(movement.escalation.at, now)}, after{" "}
              {movement.escalation.triedUnitIds.length}{" "}
              {movement.escalation.triedUnitIds.length === 1 ? "ward was" : "wards were"} tried.
            </p>
          )}
        </Section>

        <Section title="Transport leg">
          {leg === undefined ? (
            <p className={d.muted}>No transport leg has been booked, so there is nothing to say about a vehicle.</p>
          ) : (
            <p className={d.text}>
              {leg.provider}
              {leg.escortRequired ? " · escort required" : ""}
              {leg.formRequired ? " · a form is required" : ""}
              {leg.acceptedAt === undefined ? "" : ` · accepted ${formatInstantWithDay(leg.acceptedAt, now)}`}
            </p>
          )}
        </Section>

        <p className={d.foot}>
          <strong>Watch and flag is not built.</strong> Nothing in this system records that somebody is watching a
          movement, so there is no state for it to show. Every person in this prototype is invented. Nobody named here
          is a real patient.
        </p>
      </div>
    </Sheet>
  );
}
