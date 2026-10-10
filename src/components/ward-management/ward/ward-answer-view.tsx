"use client";

import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { ContextualBackLink } from "@/components/contextual-back-link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { bedsPendingPreparation, capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import {
  elapsedLabel,
  eligibilityWarning,
  isOpen,
  restrictionNotice,
  unitCapacity,
} from "@/components/ward-management/ward-derivations";
import {
  eligibility,
  GENDER_DESIGNATION_PRIVACY_SENTENCE,
  wardFacingGateDetail,
  type EligibilityGate,
} from "@/components/ward-management/ward-eligibility";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { HIGH_ACUITY_STAFFING_REFUSAL, OVERRIDE_REASON_REQUIRED } from "@/components/ward-management/ward-flow-reducer";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { DECLINE_REASONS, type DeclineReason, type Movement, type Unit } from "@/components/ward-management/ward-model";
import {
  GENDER_NO_LONGER_SUITS_REFUSAL,
  OVERRIDE_REASONS,
  type OverrideReason,
} from "@/components/ward-management/ward-change-reasons";
import { siteByCode } from "@/components/ward-management/ward-sites";

import { Hero, HeroStat, OccupancyRing, Stepper, buttonClass } from "@/components/wf";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import styles from "./ward-answer-view.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

/** The hero ring's alert line. Invented for the prototype (build guide: open for Josh). */
const ANSWER_ALERT_LINE = 95;

const WARD_GATE_LABELS: Record<EligibilityGate, string> = {
  acuity: "Acuity",
  age: "Age band",
  allocatable_bed: "Allocatable bed",
  authorisation: "Authorisation",
  capacity_freshness: "Capacity freshness",
  cohort: "Cohort",
  forensic: "Forensic bed",
  legal_status: "Legal status",
  prior_decline: "Prior decline",
  security: "Security",
  gender_designation: "Bed designation",
  sex_mix: "Sex mix",
  specialling: "Specialling",
};

const WARD_ACTION_REJECTION_LABELS: Record<string, string> = {
  ACCEPT_IN_PRINCIPLE: "Accept in principle",
  PULL_PATIENT: "Pull a bed",
  PATIENT_ARRIVED: "Confirm Arrival",
};

function wardSafeRejectionReason(reason: string): string {
  if (reason.toLowerCase().includes("non-binary")) return GENDER_DESIGNATION_PRIVACY_SENTENCE;
  if (reason.toLowerCase().includes("no longer suits this patient")) return GENDER_NO_LONGER_SUITS_REFUSAL;
  return reason;
}

// Owner, 26 Sept 2026: the patient's name, not the WF journey number.
function referralAnswerBlocked(movement: Movement, unit: Unit, who?: string): string | undefined {
  if (movement.acceptedUnitId !== undefined && movement.acceptedUnitId !== unit.id) {
    return `${who ?? "This patient"} was already accepted by another ward.`;
  }
  return undefined;
}

export interface WardAnswerViewProps {
  unitId: string;
}

export function WardAnswerView({ unitId }: WardAnswerViewProps) {
  const { movements, units, bedReleases, leaveBeds, admissions, dispatch, rejections, resolvePatientIdentity } =
    useWardFlow();
  const now = useWardFlowClock();
  const unit = units.find((candidate) => candidate.id === unitId);

  const [answerIndex, setAnswerIndex] = useState(0);
  const [overrideReason, setOverrideReason] = useState<OverrideReason | undefined>(undefined);
  const [numConsulted, setNumConsulted] = useState(false);
  const [declineOpenFor, setDeclineOpenFor] = useState<string | undefined>(undefined);
  const [declineReason, setDeclineReason] = useState<DeclineReason | undefined>(undefined);
  const [capacityDraft, setCapacityDraft] = useState<{ unitId: string; revision: number; value: string }>();
  const capacityRevision = unit?.allocatable.revision ?? 0;
  const capacityValue =
    capacityDraft?.unitId === unitId && capacityDraft.revision === capacityRevision
      ? capacityDraft.value
      : String(unit?.allocatable.value ?? 0);

  // Modal & interactive state
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [holdDuration, setHoldDuration] = useState("120");
  const [toastMessage, setToastMessage] = useState<{ message: string } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  // A response belongs to the attempt that preceded it, without reading a mutable ref in render.
  const [priorRejectionCount, setPriorRejectionCount] = useState<number>();
  const newestRejection =
    priorRejectionCount !== undefined && rejections.length > priorRejectionCount
      ? rejections[rejections.length - 1]
      : undefined;
  const lastActionRejection =
    newestRejection?.attempted === "ACCEPT_IN_PRINCIPLE" || newestRejection?.attempted === "PULL_PATIENT"
      ? newestRejection
      : undefined;

  // Escape and Tab key containment handler for modal
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!acceptModalOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setAcceptModalOpen(false);
        (openerRef.current ?? triggerRef.current)?.focus();
        return;
      }
      if (event.key === "Tab" && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute("disabled"));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          last.focus();
          event.preventDefault();
        } else if (!event.shiftKey && document.activeElement === last) {
          first.focus();
          event.preventDefault();
        }
      }
    }
    if (acceptModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
      queueMicrotask(() => {
        const first = modalRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        first?.focus();
      });
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [acceptModalOpen]);

  function triggerToast(message: string) {
    setToastMessage({ message });
  }

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  if (!unit) {
    return (
      <div className={styles.answerScreen} data-testid="ward-unit-screen">
        <main id="main-content" className={styles.workspace}>
          <h1 className={styles.panelTitle}>Ward not found</h1>
          <p data-testid="ward-unit-unresolved">
            No synthetic unit matches &ldquo;{unitId}&rdquo;. It may have been renamed or removed, or the id in the
            address is incorrect &mdash; this never falls back to a different ward.
          </p>
          <div>
            <Link href="/mockups/ward-flow/wards" className={styles.backLink}>
              &larr; View all 23 available wards
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const currentUnit = unit;
  const site = siteByCode(currentUnit.siteCode);
  const capacity = unitCapacity(currentUnit, bedReleases);
  const breakdown = capacityBreakdown(currentUnit, bedReleases, leaveBeds, now);
  // The ruled four boxes for the census grid below; "Held" is kept for a leave bed only.
  const states = bedStates(currentUnit, admissions, bedReleases, leaveBeds);
  // Owner ruling 2026-09-05, carried here: the ready figure above does not subtract a bed being
  // made ready (it must not lurch as cleaning starts and stops), so this sentence — using the
  // reducer's own `bedsPendingPreparation`, never re-derived — is what keeps a coordinator from
  // reading a bare "ready" count and being refused at the moment of pulling a patient.
  const pendingPreparation = bedsPendingPreparation(currentUnit.id, bedReleases);

  const incoming = movements.filter(
    (movement) =>
      isOpen(movement) && movement.stage === "destination_review" && movement.referredUnitIds.includes(currentUnit.id),
  );
  const activeAnswerIndex = Math.min(answerIndex, Math.max(incoming.length - 1, 0));
  const activeMovement = incoming[activeAnswerIndex];

  const recentAnswers = movements
    .flatMap((movement) => {
      const wardAnswers: Array<{
        key: string;
        movementId: string;
        outcome: "Accepted" | "Declined";
        at?: Instant;
        reason?: DeclineReason;
      }> = [];

      if (movement.acceptedUnitId === currentUnit.id) {
        wardAnswers.push({
          key: `${movement.id}-accepted`,
          movementId: movement.id,
          outcome: "Accepted",
          at: movement.acceptedAt,
        });
      }

      movement.declines
        .filter((decline) => decline.unitId === currentUnit.id)
        .forEach((decline, index) => {
          wardAnswers.push({
            key: `${movement.id}-declined-${index}`,
            movementId: movement.id,
            outcome: "Declined",
            at: decline.at,
            reason: decline.reason,
          });
        });

      return wardAnswers;
    })
    .sort((left, right) => (right.at ?? Number.NEGATIVE_INFINITY) - (left.at ?? Number.NEGATIVE_INFINITY));

  function toggleDecline(movementId: string) {
    setDeclineOpenFor((current) => (current === movementId ? undefined : movementId));
    setDeclineReason(undefined);
  }

  function submitDecline(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!declineReason) return;
    dispatch({ type: "DECLINE", role: "ward", now, movementId, unitId: currentUnit.id, reason: declineReason });
    setDeclineOpenFor(undefined);
    setDeclineReason(undefined);
    // Owner, 26 Sept 2026: no WF journey number in a person-facing toast.
    triggerToast("Referral declined.");
  }

  function handleAccept(movementId: string) {
    setPriorRejectionCount(rejections.length);
    dispatch({
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now,
      movementId,
      unitId: currentUnit.id,
    });
    setAcceptModalOpen(false);
    // Owner, 26 Sept 2026: no WF journey number in a person-facing toast.
    triggerToast("Acceptance requested.");
  }

  function submitOverride(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!overrideReason || !lastActionRejection) return;
    const attempted = lastActionRejection.attempted;
    if (attempted !== "ACCEPT_IN_PRINCIPLE" && attempted !== "PULL_PATIENT") return;

    const isAcuityRefusal = lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL);
    if (isAcuityRefusal && !numConsulted) return;
    setPriorRejectionCount(rejections.length);

    if (attempted === "ACCEPT_IN_PRINCIPLE") {
      dispatch({
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now,
        movementId,
        unitId: currentUnit.id,
        overrideReason,
      });
    } else {
      dispatch({
        type: "PULL_PATIENT",
        role: "ward",
        now,
        movementId,
        unitId: currentUnit.id,
        overrideReason,
        numConsulted: isAcuityRefusal && numConsulted ? true : undefined,
      });
    }
    setOverrideReason(undefined);
    setNumConsulted(false);
  }

  function submitCapacity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(capacityValue);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    dispatch({
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now,
      unitId: currentUnit.id,
      actingUnitId: currentUnit.id,
      value: Math.floor(parsed),
      expectedRevision: capacityRevision,
    });
    triggerToast(`Capacity confirmation requested for ${currentUnit.name}.`);
  }

  // The request waiting longest, for the hero's sub line.
  const oldestWaiting = [...incoming].sort((left, right) => left.openedAt - right.openedAt)[0];

  const activeSpeciallingCount = movements.filter((m) => m.specialling && m.acceptedUnitId === unit.id).length;

  return (
    <div className={styles.answerScreen} data-testid="ward-unit-screen">
      <div className={styles.answerTop}>
        <Hero
          level={1}
          eyebrow={`Ward answer · ${site?.name ?? unit.siteCode}${unitHealthService(unit) ? ` · ${unitHealthService(unit)}` : ""}`}
          title={
            incoming.length === 0
              ? "Nothing to answer"
              : `${incoming.length} ${incoming.length === 1 ? "request" : "requests"} to answer`
          }
          stats={
            <OccupancyRing
              className={styles.heroRing}
              percent={unit.beds > 0 ? (states.occupied / unit.beds) * 100 : null}
              alertAt={ANSWER_ALERT_LINE}
              scope={unit.name}
              status={
                unit.beds > 0 && (states.occupied / unit.beds) * 100 >= ANSWER_ALERT_LINE
                  ? { tone: "warning", word: `At risk, over ${ANSWER_ALERT_LINE}%` }
                  : { tone: "success", word: `In use, under ${ANSWER_ALERT_LINE}%` }
              }
            />
          }
          statsAlign="end"
          aside={
            incoming.length > 0 ? (
              <span className={styles.heroNav} role="group" aria-label="Bed request position">
                <button
                  type="button"
                  className={buttonClass({ variant: "onHero", size: "sm" })}
                  disabled={activeAnswerIndex === 0}
                  onClick={() => setAnswerIndex((current) => Math.max(0, current - 1))}
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                  Previous
                </button>
                <span className={styles.heroNavPos}>
                  Request <b>{activeAnswerIndex + 1}</b> of <b>{incoming.length}</b>
                </span>
                <button
                  type="button"
                  className={buttonClass({ variant: "onHero", size: "sm" })}
                  disabled={activeAnswerIndex >= incoming.length - 1}
                  onClick={() => setAnswerIndex((current) => Math.min(incoming.length - 1, current + 1))}
                >
                  Next
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </span>
            ) : null
          }
          bar={
            <div className={styles.heroChips} role="group" aria-label={`${unit.name} beds`}>
              {/* Facts, not filters: the same ruled four as the Census below, plus being made ready. */}
              <HeroStat inline value={states.occupied} label={BED_STATE_LABELS.occupied} />
              <HeroStat inline value={states.ready} label={BED_STATE_LABELS.ready} tone="success" />
              <HeroStat inline value={pendingPreparation} label={BED_STATE_LABELS.beingMadeReady} />
              <HeroStat inline value={states.pulled} label={BED_STATE_LABELS.pulled} />
              <HeroStat inline value={states.closed} label={BED_STATE_LABELS.closed} />
            </div>
          }
          foot={
            <span className={styles.heroFoot}>
              <ContextualBackLink fallbackHref={`/mockups/ward-flow/ward/${unit.id}`} className={styles.backLink}>
                <ArrowLeft size={14} aria-hidden="true" />
                <span>Ward overview</span>
              </ContextualBackLink>
              <span className={styles.heroFootMeta}>
                {unit.name}
                {oldestWaiting ? (
                  <>
                    {" "}
                    · oldest <b>{elapsedLabel(oldestWaiting, now)}</b>
                  </>
                ) : null}
              </span>
            </span>
          }
        />
      </div>

      <main id="main-content" className={styles.workspace}>
        {/* Two-Column Layout Grid */}
        <div className={styles.answerGrid}>
          {/* Left Column: SBAR Clinical Referral Panel */}
          <section
            aria-label="Awaiting your answer"
            className={activeMovement ? styles.answerSplit : styles.panel}
            data-empty={incoming.length === 0}
            tabIndex={0}
          >
            {activeMovement ? null : (
              <div className={styles.panelHeader}>
                <div className={styles.panelHeaderLeft}>
                  <h2 className={styles.panelTitle}>Bed request</h2>
                </div>
                <span className={styles.panelSub}>none waiting</span>
              </div>
            )}

            {incoming.length === 0 ? (
              <div className={styles.sbarCard}>
                <p>No referral is currently awaiting an answer from {unit.name}.</p>
              </div>
            ) : activeMovement ? (
              (() => {
                // Owner, 26 Sept 2026: no WF journey number. A ward answering a referral sees no
                // identity before it accepts (this view never joins one), so it reads "this patient".
                const blocked = referralAnswerBlocked(activeMovement, unit);
                const notice = restrictionNotice(activeMovement, unit);
                const eligibilityIssue = eligibilityWarning(activeMovement, unit, now);
                const eligibilityVerdict = eligibility(activeMovement, unit, now);
                const failedGateCount = eligibilityVerdict.gates.filter((gate) => !gate.pass).length;
                const declineOpen = declineOpenFor === activeMovement.id;

                return (
                  <div className={styles.splitGrid} data-testid={`ward-incoming-${activeMovement.id}`}>
                    <div className={styles.referralCard}>
                      <div className={styles.panelHeader}>
                        <div className={styles.panelHeaderLeft}>
                          <span
                            className={styles.answerTier}
                            data-flagged-urgent={activeMovement.flaggedUrgent ? "true" : undefined}
                          >
                            {activeMovement.urgency}
                            <span className="sr-only">
                              {activeMovement.flaggedUrgent ? ", urgent admission enquiry" : ", tier"}
                            </span>
                          </span>
                          <h2 className={styles.panelTitle}>Incoming referral</h2>
                        </div>
                        <span className={styles.panelSub}>Emergency department origin</span>
                      </div>
                      <div className={styles.sbarCard}>
                        {/* Patient Dossier Header */}
                        <div className={styles.patientDossierBanner}>
                          <div>
                            <div className={styles.patientNameLine}>Incoming patient</div>
                            <div className={styles.patientMetaLine}>
                              Cohort: {activeMovement.cohort} &bull; Security: {activeMovement.security} &bull; Sex:{" "}
                              {activeMovement.sex} &bull; {elapsedLabel(activeMovement, now)}
                            </div>
                          </div>
                          <div className={styles.patientDossierBadges}>
                            <span className={styles.badge} data-tone="danger">
                              {activeMovement.legalStatus}
                            </span>
                            {activeMovement.specialling ? (
                              <span className={styles.badge} data-tone="warn">
                                1:1 Specialling
                              </span>
                            ) : null}
                            {activeMovement.highAcuity ? (
                              <span className={styles.badge} data-tone="warn">
                                High Acuity
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* SBAR Narrative Sections */}
                        <div className={styles.sbarSection}>
                          <span className={styles.sbarTag}>Situation</span>
                          <div className={styles.sbarContent}>
                            {activeMovement.cohort} presentation requiring{" "}
                            {activeMovement.security === "Secure" ? "locked high-dependency" : "open acute"} inpatient
                            admission under {activeMovement.legalStatus}. Acute clinical escalation in emergency
                            department.
                          </div>
                        </div>

                        <div className={styles.sbarSection}>
                          <span className={styles.sbarTag}>Background</span>
                          <div className={styles.sbarContent}>
                            Known clinical history. Previous psychiatric admissions. Ceased regular maintenance
                            medications prior to presentation.
                          </div>
                        </div>

                        <div className={styles.sbarSection}>
                          <span className={styles.sbarTag}>Assessment</span>
                          <div className={styles.sbarContent}>
                            High clinical risk profile with active psychomotor agitation. Medically stabilised for
                            inpatient admission.{" "}
                            {failedGateCount > 0
                              ? "Potential admission gate incompatibilities identified below."
                              : "All clinical admission gates satisfied."}
                          </div>
                        </div>

                        <div className={styles.sbarSection}>
                          <span className={styles.sbarTag}>Recommendation</span>
                          <div className={styles.sbarContent}>
                            Admit to {unit.name}. High-dependency observations indicated.
                          </div>
                        </div>

                        {/* 8 Current Facts */}
                        {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                        <dl className={styles.answerFacts} aria-label="Current facts for this patient">
                          <div>
                            <dt>Cohort</dt>
                            <dd>{activeMovement.cohort}</dd>
                          </div>
                          <div>
                            <dt>Bed needed</dt>
                            <dd>{activeMovement.security === "Secure" ? "Secure" : "Open"}</dd>
                          </div>
                          <div>
                            <dt>Sex</dt>
                            <dd>{activeMovement.sex}</dd>
                          </div>
                          {/* Owner answer 2026-09-25 (R7, Q2): gender identity beside sex, same style. */}
                          <div>
                            <dt>Gender</dt>
                            <dd>{activeMovement.gender ?? "Not recorded"}</dd>
                          </div>
                          <div>
                            <dt>Specialling</dt>
                            <dd>{activeMovement.specialling ? "Requested" : "Not requested"}</dd>
                          </div>
                          <div>
                            <dt>High-acuity nursing</dt>
                            <dd>{activeMovement.highAcuity ? "Requested" : "Not requested"}</dd>
                          </div>
                          <div>
                            <dt>Legal status</dt>
                            <dd>{activeMovement.legalStatus}</dd>
                          </div>
                          <div>
                            <dt>From</dt>
                            <dd>Emergency department. Origin department is not disclosed in this ward view.</dd>
                          </div>
                          <div>
                            <dt>Referred</dt>
                            <dd>
                              {activeMovement.referredAt === undefined
                                ? `No ward-referral time recorded; ${elapsedLabel(activeMovement, now)} since this movement opened`
                                : `At ${formatInstantWithDay(activeMovement.referredAt, now)}, ${elapsedLabel(activeMovement, now)}`}
                            </dd>
                          </div>
                        </dl>

                        <p className={styles.answerIdentityAbsence}>
                          Patient name and age are not recorded for this movement.
                        </p>
                      </div>
                    </div>

                    <div className={styles.gatesCard}>
                      {/* 11 Clinical Gates Region */}
                      <section
                        className={styles.answerGates}
                        // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                        aria-label="This ward's own gates for this patient"
                      >
                        <div className={styles.answerGatesHeading}>
                          <h3>This ward&rsquo;s own gates</h3>
                          <span>
                            {eligibilityVerdict.gates.length - failedGateCount} of {eligibilityVerdict.gates.length}{" "}
                            pass
                          </span>
                        </div>
                        <ul>
                          {eligibilityVerdict.gates.map((gate) => (
                            <li key={gate.gate} data-pass={gate.pass}>
                              <span className={styles.answerGateMark} aria-hidden="true">
                                {gate.pass ? (
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                ) : (
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                  </svg>
                                )}
                              </span>
                              <span className={styles.answerGateCopy}>
                                <strong>{WARD_GATE_LABELS[gate.gate] ?? gate.gate}</strong>
                                <span>{wardFacingGateDetail(gate)}</span>
                              </span>
                              <strong className={styles.answerGateVerdict}>
                                {gate.pass ? "Pass" : "Does not pass"}
                              </strong>
                            </li>
                          ))}
                        </ul>
                      </section>

                      {notice ? (
                        <span
                          className={styles.badge}
                          data-testid={`ward-restriction-notice-${activeMovement.id}`}
                          data-level={notice.level}
                          data-tone="warn"
                        >
                          {notice.text}
                        </span>
                      ) : null}

                      {eligibilityIssue ? (
                        <span
                          className={styles.badge}
                          data-testid={`ward-eligibility-warning-${activeMovement.id}`}
                          data-level={eligibilityIssue.level}
                          data-tone="danger"
                        >
                          {eligibilityIssue.text}
                        </span>
                      ) : null}

                      {blocked ? (
                        <>
                          <span id={`ward-accept-unavailable-${activeMovement.id}`} className="sr-only">
                            {blocked}
                          </span>
                          <span id={`ward-decline-unavailable-${activeMovement.id}`} className="sr-only">
                            {blocked}
                          </span>
                        </>
                      ) : null}

                      {lastActionRejection?.movementId === activeMovement.id ? (
                        <p
                          className={styles.noticeProminent}
                          role="alert"
                          data-testid={`ward-action-rejection-${activeMovement.id}`}
                        >
                          {WARD_ACTION_REJECTION_LABELS[lastActionRejection.attempted] ?? lastActionRejection.attempted}{" "}
                          not recorded: {wardSafeRejectionReason(lastActionRejection.reason)}
                        </p>
                      ) : null}

                      {/* Override Reason Form */}
                      {lastActionRejection &&
                      lastActionRejection.movementId === activeMovement.id &&
                      lastActionRejection.reason.includes(OVERRIDE_REASON_REQUIRED) ? (
                        <form
                          className={styles.declineForm}
                          onSubmit={(event) => submitOverride(event, activeMovement.id)}
                          data-testid={`ward-override-form-${activeMovement.id}`}
                        >
                          <fieldset className={styles.declineFieldset}>
                            <legend className={styles.declineLegend}>Record why this is going ahead anyway</legend>
                            {OVERRIDE_REASONS.map((reason) => (
                              <label key={reason} className={styles.declineOption}>
                                <input
                                  type="radio"
                                  name={`ward-override-${activeMovement.id}`}
                                  value={reason}
                                  checked={overrideReason === reason}
                                  onChange={() => setOverrideReason(reason)}
                                  data-testid={`ward-override-option-${activeMovement.id}`}
                                />
                                {reason}
                              </label>
                            ))}
                            {lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL) ? (
                              <label className={styles.declineOption}>
                                <input
                                  type="checkbox"
                                  checked={numConsulted}
                                  onChange={(event) => setNumConsulted(event.target.checked)}
                                  data-testid={`ward-override-num-consulted-${activeMovement.id}`}
                                />
                                Nurse unit manager consulted
                              </label>
                            ) : null}
                            <button
                              type="submit"
                              className={`${styles.btn} ${styles.btnGood}`}
                              disabled={
                                !overrideReason ||
                                (lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL) && !numConsulted)
                              }
                              data-testid={`ward-override-submit-${activeMovement.id}`}
                            >
                              Record reason and continue
                            </button>
                          </fieldset>
                        </form>
                      ) : null}

                      {/* Inline Decline Form */}
                      {declineOpen && !blocked ? (
                        <form
                          className={styles.declineForm}
                          onSubmit={(event) => submitDecline(event, activeMovement.id)}
                          data-testid={`ward-decline-form-${activeMovement.id}`}
                        >
                          <fieldset className={styles.declineFieldset}>
                            <legend className={styles.declineLegend}>Decline reason for {activeMovement.id}</legend>
                            {DECLINE_REASONS.map((reason) => (
                              <label key={reason} className={styles.declineOption}>
                                <input
                                  type="radio"
                                  name={`decline-reason-${activeMovement.id}`}
                                  value={reason}
                                  checked={declineReason === reason}
                                  onChange={() => setDeclineReason(reason)}
                                />
                                {reason.replace(/_/g, " ")}
                              </label>
                            ))}
                          </fieldset>
                          <button
                            type="submit"
                            disabled={!declineReason}
                            className={`${styles.btn} ${styles.btnDanger}`}
                          >
                            Confirm decline
                          </button>
                        </form>
                      ) : null}

                      {/* Decision Action Controls */}
                      <div className={styles.decisionArea}>
                        <button
                          type="button"
                          className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.askButton}`}
                          onClick={() => triggerToast("Not wired in this prototype.")}
                        >
                          Ask a question
                        </button>
                        <button
                          type="button"
                          data-testid={`ward-decline-toggle-${activeMovement.id}`}
                          aria-disabled={blocked ? "true" : undefined}
                          aria-describedby={blocked ? `ward-decline-unavailable-${activeMovement.id}` : undefined}
                          title={blocked ?? undefined}
                          aria-expanded={declineOpen}
                          className={buttonClass({ variant: "sec", size: "sm" })}
                          onClick={blocked ? undefined : () => toggleDecline(activeMovement.id)}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          data-testid={`ward-accept-${activeMovement.id}`}
                          aria-disabled={blocked ? "true" : undefined}
                          aria-describedby={blocked ? `ward-accept-unavailable-${activeMovement.id}` : undefined}
                          title={blocked ?? undefined}
                          className={buttonClass({ variant: "pri", size: "sm" })}
                          onClick={() => {
                            if (blocked) return;
                            handleAccept(activeMovement.id);
                          }}
                        >
                          Accept in principle
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : null}
          </section>

          {/* Right Column: Bed Map Census & Operations */}
          <div className={styles.lowerRow}>
            {/* Confirm Your Beds (Capacity Form) */}
            <section className={styles.panel} data-answer-panel="capacity" aria-label="Confirm your beds" tabIndex={0}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Confirm your beds</h2>
              </div>
              <div className={styles.capacityPanelBody}>
                <dl className={styles.capacityFacts} aria-label={`Current bed facts for ${unit.name}`}>
                  <div>
                    <dt>Ready now</dt>
                    <dd>{states.ready}</dd>
                  </div>
                  <div>
                    <dt>Physically empty</dt>
                    <dd>{unit.empty.value}</dd>
                  </div>
                  <div>
                    <dt>Allocatable</dt>
                    <dd>{unit.allocatable.value}</dd>
                  </div>
                  <div>
                    <dt>Confirmed discharges</dt>
                    <dd>{breakdown.confirmedToday}</dd>
                  </div>
                  <div>
                    <dt>Expected discharges</dt>
                    <dd>{breakdown.expectedToday}</dd>
                  </div>
                </dl>
                {pendingPreparation > 0 ? (
                  <p className={styles.bedsPendingPreparation} data-testid="ward-answer-beds-pending">
                    <strong>
                      {pendingPreparation} of the {states.ready} ready {states.ready === 1 ? "bed" : "beds"} at{" "}
                      {unit.name} {pendingPreparation === 1 ? "is" : "are"} still being made ready.
                    </strong>{" "}
                    The bed stays offered and stays counted — pulling the next patient takes hours anyway — but the ward
                    cannot admit into it yet.
                  </p>
                ) : null}
                <div className={styles.freshnessRow}>
                  <div className={styles.freshnessCard}>
                    <strong>Physically empty beds</strong>
                    <WardFreshness
                      confirmedAt={unit.empty.confirmedAt}
                      confirmedByRole={unit.empty.source === "ward" ? `NUM ${unit.name}` : undefined}
                      now={now}
                      derived={unit.empty.source !== "ward"}
                    />
                  </div>
                  <div className={styles.freshnessCard}>
                    <strong>Allocatable beds</strong>
                    <WardFreshness
                      confirmedAt={unit.allocatable.confirmedAt}
                      confirmedByRole={unit.allocatable.source === "ward" ? `NUM ${unit.name}` : undefined}
                      now={now}
                      derived={unit.allocatable.source !== "ward"}
                    />
                  </div>
                </div>

                <form className={styles.capacityForm} onSubmit={submitCapacity} data-testid="ward-capacity-form">
                  <span className={styles.capacityLabel} id="ward-capacity-label">
                    Allocatable now, for {unit.name}
                  </span>
                  <div className={styles.capacityRow}>
                    {/* v10: one control only, a stepper; no slider and no free number box. */}
                    <Stepper
                      value={Number(capacityValue) || 0}
                      min={0}
                      max={unit.beds}
                      noun="allocatable beds"
                      valueTestId="ward-capacity-input"
                      onChange={(next) => setCapacityDraft({ unitId, revision: capacityRevision, value: String(next) })}
                    />
                    <button
                      type="submit"
                      data-testid="ward-capacity-submit"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                    >
                      Confirm
                    </button>
                  </div>
                  <p className={styles.capacityConfirmed}>
                    Currently confirmed {unit.allocatable.value} at {formatInstant(unit.allocatable.confirmedAt)}.
                    Writes to {unit.name} only &mdash; never any other ward.
                  </p>
                </form>
              </div>
            </section>

            {/* Unit Bed Map Census */}
            <section className={styles.panel} aria-label={`${unit.name} Census`}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Census</h2>
                <span className={styles.panelSub}>
                  {unit.beds} beds · {states.ready} ready
                </span>
              </div>
              {pendingPreparation > 0 ? (
                <p className={styles.notice}>
                  {pendingPreparation} of the {states.ready} ready {states.ready === 1 ? "bed" : "beds"} at{" "}
                  {currentUnit.name} {pendingPreparation === 1 ? "is" : "are"} still being made ready.
                </p>
              ) : null}
              <div className={styles.bedGrid}>
                {Array.from({ length: unit.beds }, (_, i) => {
                  const bedNum = String(i + 1).padStart(2, "0");
                  // Counts drawn in the ruled order — Ready, Pulled, Closed, then Occupied — never
                  // particular beds: no admission records a bed number.
                  const isVacant = i < states.ready;
                  const isPulled = !isVacant && i < states.ready + states.pulled;
                  const isClosed = !isVacant && !isPulled && i < states.ready + states.pulled + states.closed;
                  const statusLabel = isVacant
                    ? "READY"
                    : isPulled
                      ? BED_STATE_LABELS.pulled
                      : isClosed
                        ? BED_STATE_LABELS.closed
                        : "Inpatient";
                  const cellClass = `${styles.bedCell} ${
                    isVacant ? styles.vacant : isPulled ? styles.pulled : isClosed ? styles.closed : styles.occupied
                  }`;
                  return (
                    <button
                      type="button"
                      key={bedNum}
                      className={cellClass}
                      onClick={(e) => {
                        if (isVacant && activeMovement) {
                          openerRef.current = e.currentTarget;
                          setAcceptModalOpen(true);
                        }
                      }}
                      aria-label={`Bed ${bedNum} ${statusLabel}`}
                      disabled={!isVacant}
                    >
                      <span className={styles.bedNum}>{bedNum}</span>
                      <span>{statusLabel}</span>
                    </button>
                  );
                })}
              </div>
              {/* Shift milieu and staffing balance. The ratio ("1 : 3 (Compliant)"), the shift name and a
                65/35 male-to-female split of the occupied count were typed in here (25 September
                2026 review). Ward Flow holds no staffing figures and this screen counts no one's
                sex, so both rows say so rather than show a number. */}
              <div className={styles.milieuList}>
                <div className={styles.milieuRow}>
                  <span className={styles.milieuLabel}>Nurse ratio</span>
                  <span className={styles.milieuValue}>not recorded</span>
                </div>
                <div className={styles.milieuRow}>
                  <span className={styles.milieuLabel}>Sex mix</span>
                  <span className={styles.milieuValue}>not counted here</span>
                </div>
                <div className={styles.milieuRow}>
                  <span className={styles.milieuLabel}>1:1 specialling</span>
                  <span className={styles.milieuValue}>{activeSpeciallingCount} active</span>
                </div>
                <div className={styles.milieuRow}>
                  <span className={styles.milieuLabel}>Expected out today</span>
                  <span className={styles.milieuValue}>{breakdown.expectedToday}</span>
                </div>
              </div>
            </section>

            {/* Recent Answers (History Ledger) */}
            <section className={styles.panel} data-answer-panel="history" aria-label="Recent answers" tabIndex={0}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Recent answers</h2>
              </div>
              <div className={styles.historyPanelBody}>
                <p className={styles.historyScopeNote}>
                  Recorded acceptances and declines for this ward. The prototype does not hold a shift boundary or the
                  name of the person who answered.
                </p>
                {recentAnswers.length === 0 ? (
                  <p>No accepted or declined answers are recorded for {unit.name}.</p>
                ) : (
                  <ul className={styles.historyList} data-testid="ward-answer-history">
                    {recentAnswers.map((answer) => (
                      <li key={answer.key} data-testid={`ward-answer-history-${answer.key}`}>
                        {/* D-39 through the provider's identity projection, so a referral-linked journey keeps its UMRN. */}
                        <strong>{resolvePatientIdentity({ movementId: answer.movementId }).umrn}</strong>
                        <span>{answer.outcome}</span>
                        <span>{answer.reason ? answer.reason.replace(/_/g, " ") : "Accepted by this ward"}</span>
                        {answer.at === undefined ? (
                          <span>Time not recorded</span>
                        ) : (
                          <time>{formatInstantWithDay(answer.at, now)}</time>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Accept & Allocate Bed Modal */}
      {acceptModalOpen && activeMovement ? (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="accept-modal-title"
          ref={modalRef}
        >
          <div className={styles.modalDialog}>
            <div className={styles.modalHead}>
              <h3 id="accept-modal-title" className={styles.modalTitle}>
                Accept Referral in Principle
              </h3>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSm}`}
                onClick={() => {
                  setAcceptModalOpen(false);
                  (openerRef.current ?? triggerRef.current)?.focus();
                }}
              >
                Cancel
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="ward-answer-allocating-movement">
                  Allocating Movement
                </label>
                <input
                  type="text"
                  className={styles.formInput}
                  id="ward-answer-allocating-movement"
                  value={`${activeMovement.id} (${activeMovement.cohort})`}
                  readOnly
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="ward-answer-target-unit">
                  Target Unit
                </label>
                <input
                  type="text"
                  className={styles.formInput}
                  id="ward-answer-target-unit"
                  value={`${unit.name} \u2014 ${capacity.available > 0 ? "Bed Available" : "Allocatable Bed"}`}
                  readOnly
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="hold-duration-select">
                  Bed Hold Expiry Duration
                </label>
                <select
                  id="hold-duration-select"
                  className={styles.formSelect}
                  value={holdDuration}
                  onChange={(e) => setHoldDuration(e.target.value)}
                >
                  <option value="120">120 Minutes (Standard Transport Hold)</option>
                  <option value="180">180 Minutes (Extended Travel Buffer)</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="num-endorsement-input">
                  Receiving Nurse Unit Manager Endorsement
                </label>
                <input
                  id="num-endorsement-input"
                  type="text"
                  className={styles.formInput}
                  defaultValue={`NUM ${unit.name}`}
                />
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  setAcceptModalOpen(false);
                  (openerRef.current ?? triggerRef.current)?.focus();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGood}`}
                onClick={() => {
                  const opener = openerRef.current;
                  handleAccept(activeMovement.id);
                  if (opener && document.body.contains(opener) && !opener.hasAttribute("disabled")) {
                    opener.focus();
                  } else {
                    triggerRef.current?.focus();
                  }
                }}
              >
                Confirm Acceptance in Principle
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Action Toast */}
      {toastMessage ? (
        <div className={styles.toast} role="status" aria-live="polite">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage.message}</span>
        </div>
      ) : null}
      <WardPrototypeFooter
        testId="ward-unit-governance"
        note={`Scoped to ${unit.name} · Bed decisions remain human-confirmed · Not a medical device`}
      />
    </div>
  );
}
