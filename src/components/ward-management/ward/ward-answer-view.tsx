"use client";

import { WardNotFoundBody } from "@/components/ward-management/shell/ward-not-found";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronRight as RowChevron, ShieldCheck, UserRound } from "lucide-react";
import { ContextualBackLink } from "@/components/contextual-back-link";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

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
import { formatWardOccupancy, wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useWardModalFocus, useWardPageScrollLock } from "@/components/ward-management/ward-modal-focus";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { HIGH_ACUITY_STAFFING_REFUSAL, OVERRIDE_REASON_REQUIRED } from "@/components/ward-management/ward-flow-reducer";
import { DECLINE_REASONS, type DeclineReason, type Movement, type Unit } from "@/components/ward-management/ward-model";
import {
  GENDER_NO_LONGER_SUITS_REFUSAL,
  OVERRIDE_REASONS,
  type OverrideReason,
} from "@/components/ward-management/ward-change-reasons";
import { siteByCode } from "@/components/ward-management/ward-sites";

import {
  Hero,
  HeroStat,
  LiveChip,
  OccupancyRing,
  Stepper,
  StatusGlyph,
  buttonClass,
  durMinutes,
  useIsPhone,
  PhoneSheet,
} from "@/components/wf";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import styles from "./ward-answer-view.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import {
  canSubmitDecline,
  canSubmitOverride,
  DECLINE_SUBMIT_UNAVAILABLE_REASON,
  OVERRIDE_SUBMIT_UNAVAILABLE_REASON,
} from "./ward-home-tab";

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

/** A decline reason as a sentence-case label ("no_bed" reads "No bed"). */
function declineReasonLabel(reason: DeclineReason): string {
  const words = reason.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function WardAnswerView({ unitId }: WardAnswerViewProps) {
  const [, startTransition] = useTransition();
  const { movements, units, bedReleases, leaveBeds, admissions, dispatch, rejections, resolvePatientIdentity } =
    useWardFlowSelect(
      "movements",
      "units",
      "bedReleases",
      "leaveBeds",
      "admissions",
      "dispatch",
      "rejections",
      "resolvePatientIdentity",
    );
  const now = useWardFlowClock();
  const raise = useWardRaise("ward");
  const unit = units.find((candidate) => candidate.id === unitId);

  const [answerIndex, setAnswerIndex] = useState(0);
  // Phone (v10): its own layout. The facts show four until asked, the ISBAR summary and the
  // ward's gates fold, and the beds, census and answers are rows that open in place.
  const isPhone = useIsPhone();
  const [showAllFacts, setShowAllFacts] = useState(false);
  // Phone (v10): the gates, beds, census and answers rows each open their panel as a bottom sheet.
  const [phoneSheet, setPhoneSheet] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState<OverrideReason | undefined>(undefined);
  const [numConsulted, setNumConsulted] = useState(false);
  const [declineOpenFor, setDeclineOpenFor] = useState<string | undefined>(undefined);
  const [declineReason, setDeclineReason] = useState<DeclineReason | undefined>(undefined);
  const [declineNudge, setDeclineNudge] = useState(false);
  const declinePendingRef = useRef(false);
  const [declinePending, setDeclinePending] = useState(false);
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

  useWardModalFocus(acceptModalOpen, modalRef, () => {
    setAcceptModalOpen(false);
    (openerRef.current ?? triggerRef.current)?.focus();
  });

  function triggerToast(message: string) {
    setToastMessage({ message });
  }

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // v10 pass 3: Accept dispatches at once and offers Undo on the layout's toast; this page's own
  // toast line carries the outcome where no toast region is mounted.
  const routeRole = useRouteRole();
  const { run: runStep } = useUndoableStep({
    dispatch,
    rejections,
    now,
    routeRole,
    onMessage: triggerToast,
    sayRefusal: wardSafeRejectionReason,
  });

  // Hooks run before the early return below; the accept sheet only opens on a ward's incoming answer.
  useWardPageScrollLock(acceptModalOpen && unit !== undefined);
  const hasUnsavedAnswerDraft = Boolean(
    declineReason !== undefined ||
    overrideReason !== undefined ||
    numConsulted ||
    (capacityDraft?.unitId === unitId &&
      capacityDraft.revision === capacityRevision &&
      capacityDraft.value !== String(unit?.allocatable.value ?? 0)),
  );
  useDirtyStateGuard({ isDirty: hasUnsavedAnswerDraft });

  // A1-9 (audit round 2): longest wait first, as the Referrals board orders its queue.
  const incoming = useMemo(
    () =>
      !unit
        ? []
        : movements
            .filter(
              (movement) =>
                isOpen(movement) &&
                movement.stage === "destination_review" &&
                movement.referredUnitIds.includes(unit.id),
            )
            .sort((left, right) => left.openedAt - right.openedAt),
    [movements, unit],
  );
  const recentAnswers = useMemo(
    () =>
      !unit
        ? []
        : movements
            .flatMap((movement) => {
              const wardAnswers: Array<{
                key: string;
                movementId: string;
                outcome: "Accepted" | "Declined";
                at?: Instant;
                reason?: DeclineReason;
              }> = [];

              if (movement.acceptedUnitId === unit.id) {
                wardAnswers.push({
                  key: `${movement.id}-accepted`,
                  movementId: movement.id,
                  outcome: "Accepted",
                  at: movement.acceptedAt,
                });
              }

              movement.declines
                .filter((decline) => decline.unitId === unit.id)
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
            .sort((left, right) => (right.at ?? Number.NEGATIVE_INFINITY) - (left.at ?? Number.NEGATIVE_INFINITY)),
    [movements, unit],
  );

  if (!unit) {
    return (
      <div className={styles.answerScreen} data-testid="ward-unit-screen">
        <main id="main-content" className={styles.workspace}>
          <WardNotFoundBody
            title="Ward not found"
            testId="ward-unit-unresolved"
            list={{ href: "/mockups/ward-flow/wards", label: "All wards" }}
          >
            No ward matches this link. It never falls back to a different ward.
          </WardNotFoundBody>
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
  // The one occupancy figure (Occupied + Pulled, `ward-occupancy.ts`), so this ward reads the same
  // percentage here as on its Ward page, the rail and Capacity.
  const occupancy = wardOccupancy([currentUnit], admissions, bedReleases);
  // Owner ruling 2026-09-05, carried here: the ready figure above does not subtract a bed being
  // made ready (it must not lurch as cleaning starts and stops), so this sentence — using the
  // reducer's own `bedsPendingPreparation`, never re-derived — is what keeps a coordinator from
  // reading a bare "ready" count and being refused at the moment of pulling a patient.
  const pendingPreparation = bedsPendingPreparation(currentUnit.id, bedReleases);

  const activeAnswerIndex = Math.min(answerIndex, Math.max(incoming.length - 1, 0));
  const activeMovement = incoming[activeAnswerIndex];

  function toggleDecline(movementId: string) {
    if (declinePendingRef.current) return;
    startTransition(() => {
      setDeclineOpenFor((current) => (current === movementId ? undefined : movementId));
      setDeclineReason(undefined);
      setDeclineNudge(false);
    });
  }

  function submitDecline(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    void confirmDecline(movementId);
  }

  /** Desktop and phone keep the reason until this particular command is accepted. */
  async function confirmDecline(movementId: string) {
    if (declinePendingRef.current) return;
    if (!canSubmitDecline(declineReason)) {
      setDeclineNudge(true);
      return;
    }
    setDeclineNudge(false);
    declinePendingRef.current = true;
    setDeclinePending(true);
    try {
      const outcome = await raise("DECLINE", {
        movementId,
        unitId: currentUnit.id,
        actingUnitId: currentUnit.id,
        reason: declineReason,
      });
      if (outcome?.status === "accepted" && outcome.isCurrent?.() !== false) {
        setDeclineOpenFor(undefined);
        setDeclineReason(undefined);
        triggerToast("Referral declined.");
      } else {
        triggerToast(
          outcome?.message ?? "Decline was not confirmed. Your reason is kept; review the board before trying again.",
        );
      }
    } catch {
      triggerToast("Decline was not confirmed. Your reason is kept; review the board before trying again.");
    } finally {
      declinePendingRef.current = false;
      setDeclinePending(false);
    }
  }

  function handleAccept(movementId: string) {
    setPriorRejectionCount(rejections.length);
    const unitIdHere = currentUnit.id;
    // v10 pass 3: Accept, then Undo on the toast (`UNDO_ACCEPT_IN_PRINCIPLE`, this ward's own).
    // Owner, 26 Sept 2026: no WF journey number in a person-facing toast.
    runStep(
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", now, movementId, unitId: unitIdHere, actingUnitId: unitIdHere },
      {
        success: "Accepted in principle.",
        undo: (at) => ({
          type: "UNDO_ACCEPT_IN_PRINCIPLE",
          role: "ward",
          now: at,
          movementId,
          actingUnitId: unitIdHere,
        }),
        undone: "Acceptance undone. The referral is back with this ward.",
      },
    );
    setAcceptModalOpen(false);
  }

  function submitOverride(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!overrideReason || !lastActionRejection) return;
    const attempted = lastActionRejection.attempted;
    if (attempted !== "ACCEPT_IN_PRINCIPLE" && attempted !== "PULL_PATIENT") return;

    const isAcuityRefusal = lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL);
    if (!canSubmitOverride(overrideReason, isAcuityRefusal, numConsulted)) return;
    setPriorRejectionCount(rejections.length);

    if (attempted === "ACCEPT_IN_PRINCIPLE") {
      raise("ACCEPT_IN_PRINCIPLE", {
        movementId,
        unitId: currentUnit.id,
        actingUnitId: currentUnit.id,
        overrideReason,
      });
    } else {
      raise("PULL_PATIENT", {
        movementId,
        unitId: currentUnit.id,
        actingUnitId: currentUnit.id,
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
    raise("CONFIRM_CAPACITY", {
      unitId: currentUnit.id,
      actingUnitId: currentUnit.id,
      value: Math.floor(parsed),
      expectedRevision: capacityRevision,
    });
    triggerToast(`Capacity confirmation requested for ${currentUnit.name}.`);
  }

  // The request waiting longest, for the hero's sub line.
  const oldestWaiting = [...incoming].sort((left, right) => left.openedAt - right.openedAt)[0];

  const phoneGatesVerdict = activeMovement ? eligibility(activeMovement, unit, now) : undefined;
  const phoneGates = phoneGatesVerdict
    ? {
        pass: phoneGatesVerdict.gates.filter((gate) => gate.pass).length,
        total: phoneGatesVerdict.gates.length,
      }
    : undefined;

  /** Phone: the ward's own gates sit under one row saying whether this patient fits; it opens them as a sheet. */
  function phoneGatesSection(section: ReactNode, pass: number, total: number) {
    if (!isPhone) return section;
    return (
      <>
        <button
          type="button"
          className={styles.phoneGates}
          aria-haspopup="dialog"
          data-testid="ward-answer-fold-gates"
          onClick={() => {
            setPhoneSheet("gates");
          }}
        >
          <StatusGlyph tone={pass === total ? "success" : "warning"} size={10} />
          <span className={styles.phoneFoldText}>
            <span className={styles.phoneFoldTitle}>{pass === total ? "Fits this ward" : "Check the gates"}</span>
            <span className={styles.phoneFoldLine}>
              <span className={styles.phoneGatesCount}>
                {pass}/{total}
              </span>{" "}
              of this ward&rsquo;s own gates pass
            </span>
          </span>
          <RowChevron size={16} aria-hidden="true" className={styles.phoneFoldChevron} />
        </button>
        <PhoneSheet
          open={phoneSheet === "gates"}
          onClose={() => {
            setPhoneSheet(null);
          }}
          title="This ward's own gates"
          description={`Checked against ${currentUnit.name} now`}
          height="tall"
        >
          <div className={`${styles.phoneSheetScope} ${styles.phoneSheetGates}`}>{section}</div>
        </PhoneSheet>
      </>
    );
  }

  /** Phone: a panel is one row (title, one line, a count) that opens it as a bottom sheet. */
  function phoneFold(id: string, title: string, line: ReactNode, count: ReactNode, panel: ReactNode) {
    if (!isPhone) return panel;
    const description =
      id === "capacity"
        ? `Writes to ${currentUnit.name} only`
        : id === "history"
          ? "Recorded acceptances and declines for this ward"
          : id === "census"
            ? `${currentUnit.beds} beds · ${states.ready} ready`
            : undefined;
    return (
      <>
        <button
          type="button"
          className={styles.phoneFold}
          aria-haspopup="dialog"
          data-testid={`ward-answer-fold-${id}`}
          onClick={() => {
            setPhoneSheet(id);
          }}
        >
          <span className={styles.phoneFoldText}>
            <span className={styles.phoneFoldTitle}>{title}</span>
            <span className={styles.phoneFoldLine}>{line}</span>
          </span>
          <span className={styles.phoneFoldCount}>{count}</span>
          <RowChevron size={16} aria-hidden="true" className={styles.phoneFoldChevron} />
        </button>
        <PhoneSheet
          open={phoneSheet === id}
          onClose={() => {
            setPhoneSheet(null);
          }}
          title={title}
          description={description}
        >
          <div className={`${styles.phoneSheetScope} ${styles.phoneFoldBody}`}>{panel}</div>
        </PhoneSheet>
      </>
    );
  }

  const activeSpeciallingCount = movements.filter((m) => m.specialling && m.acceptedUnitId === unit.id).length;

  return (
    <div className={styles.answerScreen} data-testid="ward-unit-screen">
      <div className={styles.answerTop}>
        <Hero
          level={1}
          eyebrow={
            isPhone
              ? `Ward answer · ${unit.name}`
              : `Ward answer · ${site?.name ?? unit.siteCode}${unitHealthService(unit) ? ` · ${unitHealthService(unit)}` : ""}`
          }
          // One title on every device (device audit, 11 Oct 2026; the build guide's "Nothing to answer").
          title={
            incoming.length === 0
              ? "Nothing to answer"
              : `${incoming.length} ${incoming.length === 1 ? "request" : "requests"} to answer`
          }
          titleMeta={
            isPhone
              ? activeMovement
                ? `Tier ${activeMovement.urgency} · waiting ${elapsedLabel(activeMovement, now).replace(/ waiting$/, "")} · from an ED`
                : `${recentAnswers[0]?.at !== undefined ? `Last answer at ${formatInstantWithDay(recentAnswers[0].at, now)} · ` : ""}${states.ready} ${states.ready === 1 ? "bed" : "beds"} ready`
              : undefined
          }
          stats={
            isPhone ? (
              <>
                <HeroStat value={states.ready} label="Ready" tone="success" />
                <HeroStat value={formatWardOccupancy(occupancy)} label="In use" />
                {phoneGates ? (
                  <HeroStat
                    value={`${phoneGates.pass}/${phoneGates.total}`}
                    label="Gates pass"
                    tone={phoneGates.pass === phoneGates.total ? "success" : "warning"}
                  />
                ) : (
                  <HeroStat value={recentAnswers.length} label="Answers" />
                )}
              </>
            ) : undefined
          }
          lead={
            isPhone ? undefined : (
              <OccupancyRing
                percent={occupancy.percent}
                alertAt={ANSWER_ALERT_LINE}
                scope={unit.name}
                status={
                  occupancy.percent !== null && occupancy.percent >= ANSWER_ALERT_LINE
                    ? { tone: "warning", word: `At risk, over ${ANSWER_ALERT_LINE}%` }
                    : { tone: "success", word: `In use, under ${ANSWER_ALERT_LINE}%` }
                }
              />
            )
          }
          aside={
            incoming.length > 1 ? (
              <>
                {isPhone ? <LiveChip state="live" onHero /> : null}
                {/* Previous and Next show only when there is more than one request to step through. */}
                <span className={styles.heroNav} role="group" aria-label="Bed request position">
                  <button
                    type="button"
                    className={buttonClass({ variant: "onHero", size: "sm" })}
                    aria-disabled={activeAnswerIndex === 0 ? "true" : undefined}
                    aria-describedby={activeAnswerIndex === 0 ? "ward-answer-prev-reason" : undefined}
                    title={activeAnswerIndex === 0 ? "Already on the first request." : undefined}
                    onClick={(event) => {
                      if (activeAnswerIndex === 0) {
                        ignoreUnavailableActivation(event);
                        return;
                      }
                      setAnswerIndex((current) => Math.max(0, current - 1));
                    }}
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                    Previous
                  </button>
                  {activeAnswerIndex === 0 ? (
                    <span id="ward-answer-prev-reason" className="sr-only">
                      Already on the first request.
                    </span>
                  ) : null}
                  <span className={styles.heroNavPos}>
                    Request <b>{activeAnswerIndex + 1}</b> of <b>{incoming.length}</b>
                  </span>
                  <button
                    type="button"
                    className={buttonClass({ variant: "onHero", size: "sm" })}
                    aria-disabled={activeAnswerIndex >= incoming.length - 1 ? "true" : undefined}
                    aria-describedby={activeAnswerIndex >= incoming.length - 1 ? "ward-answer-next-reason" : undefined}
                    title={activeAnswerIndex >= incoming.length - 1 ? "Already on the last request." : undefined}
                    onClick={(event) => {
                      if (activeAnswerIndex >= incoming.length - 1) {
                        ignoreUnavailableActivation(event);
                        return;
                      }
                      setAnswerIndex((current) => Math.min(incoming.length - 1, current + 1));
                    }}
                  >
                    Next
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                  {activeAnswerIndex >= incoming.length - 1 ? (
                    <span id="ward-answer-next-reason" className="sr-only">
                      Already on the last request.
                    </span>
                  ) : null}
                </span>
              </>
            ) : isPhone ? (
              <LiveChip state="live" onHero />
            ) : null
          }
          bar={
            isPhone ? undefined : (
              <div className={styles.heroChips} role="group" aria-label={`${unit.name} beds`}>
                {/* Facts, not filters: the same ruled four as the Census below, plus being made ready. */}
                <HeroStat inline value={states.occupied} label={BED_STATE_LABELS.occupied} />
                <HeroStat inline value={states.ready} label={BED_STATE_LABELS.ready} tone="success" />
                {/* U3: no "0 being made ready" chip; it shows only when a bed is being made ready. */}
                {pendingPreparation > 0 ? (
                  <HeroStat inline value={pendingPreparation} label={BED_STATE_LABELS.beingMadeReady} />
                ) : null}
                <HeroStat inline value={states.pulled} label={BED_STATE_LABELS.pulled} />
                <HeroStat inline value={states.closed} label={BED_STATE_LABELS.closed} />
              </div>
            )
          }
          foot={
            isPhone ? undefined : (
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
            )
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
          >
            {activeMovement || isPhone ? null : (
              <div className={styles.panelHeader}>
                <div className={styles.panelHeaderLeft}>
                  <h2 className={styles.panelTitle}>Bed request</h2>
                </div>
                <span className={styles.panelSub}>none waiting</span>
              </div>
            )}

            {incoming.length === 0 && isPhone ? (
              <div className={styles.phoneClear}>
                <p className={styles.phoneClearTitle}>
                  <StatusGlyph tone="success" size={12} />
                  All answered
                </p>
                <p className={styles.phoneClearText}>
                  No referral is currently awaiting an answer from {unit.name}. Requests land here as they are sent.
                </p>
              </div>
            ) : incoming.length === 0 ? (
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
                const sbarSections = (
                  <>
                    <div className={styles.sbarSection}>
                      <span className={styles.sbarTag}>Situation</span>
                      <div className={styles.sbarContent}>
                        {activeMovement.cohort} presentation requiring{" "}
                        {activeMovement.security === "Secure" ? "locked high-dependency" : "open acute"} inpatient
                        admission under {activeMovement.legalStatus}. Acute clinical escalation in emergency department.
                      </div>
                    </div>

                    <div className={styles.sbarSection}>
                      <span className={styles.sbarTag}>Background</span>
                      <div className={styles.sbarContent}>
                        Known clinical history. Previous psychiatric admissions. Ceased regular maintenance medications
                        prior to presentation.
                      </div>
                    </div>

                    <div className={styles.sbarSection}>
                      <span className={styles.sbarTag}>Assessment</span>
                      <div className={styles.sbarContent}>
                        High clinical risk profile with active psychomotor agitation. Medically stabilised for inpatient
                        admission.{" "}
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
                  </>
                );

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
                        {isPhone ? (
                          /* Phone (v10): "This patient" with the person tile; the facts below carry cohort and sex. */
                          <div className={styles.phonePatientHead}>
                            <span className={styles.phonePatientTile} aria-hidden="true">
                              <UserRound size={18} aria-hidden="true" />
                            </span>
                            <span className={styles.phoneFoldText}>
                              <span className={styles.phoneFoldTitle}>This patient</span>
                              <span className={styles.phonePatientLine}>Name and UMRN shared on acceptance</span>
                            </span>
                          </div>
                        ) : null}
                        {isPhone ? (
                          <div className={styles.phonePatientChips}>
                            <span className={styles.phonePatientChip}>
                              <ShieldCheck size={14} aria-hidden="true" />
                              {activeMovement.legalStatus}
                            </span>
                            {activeMovement.specialling ? (
                              <span className={styles.phonePatientChip}>1:1 specialling</span>
                            ) : null}
                            {activeMovement.highAcuity ? (
                              <span className={styles.phonePatientChip}>High acuity</span>
                            ) : null}
                          </div>
                        ) : (
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
                        )}

                        {/* SBAR Narrative Sections */}
                        {isPhone ? null : sbarSections}

                        {/* 8 Current Facts */}
                        {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                        <dl
                          className={styles.answerFacts}
                          aria-label="Current facts for this patient"
                          data-folded={isPhone && !showAllFacts ? "true" : undefined}
                          id="ward-answer-facts"
                        >
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
                          {/* Owner answer 2026-09-25 (R7, Q2): gender identity beside sex, same style.
                              Phone (device audit, 11 Oct 2026) shows it only when it differs from sex. */}
                          {isPhone && activeMovement.gender === activeMovement.sex ? null : (
                            <div>
                              <dt>Gender</dt>
                              <dd>{activeMovement.gender ?? "Not recorded"}</dd>
                            </div>
                          )}
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

                        {isPhone ? (
                          <button
                            type="button"
                            className={styles.phoneLinkRow}
                            aria-expanded={showAllFacts}
                            aria-controls="ward-answer-facts"
                            onClick={() => setShowAllFacts((open) => !open)}
                          >
                            {showAllFacts
                              ? "Show fewer facts"
                              : `Show all ${activeMovement.gender === activeMovement.sex ? 8 : 9} facts`}
                          </button>
                        ) : null}
                        {isPhone ? (
                          <details className={styles.phoneIsbar}>
                            <summary className={styles.phoneLinkRow}>Show ISBAR summary</summary>
                            {sbarSections}
                          </details>
                        ) : null}

                        <p className={styles.answerIdentityAbsence}>
                          Patient name and age are not recorded for this movement.
                        </p>
                      </div>
                    </div>

                    <div className={styles.gatesCard}>
                      {/* 11 Clinical Gates Region */}
                      {phoneGatesSection(
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
                        </section>,
                        eligibilityVerdict.gates.length - failedGateCount,
                        eligibilityVerdict.gates.length,
                      )}

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
                              aria-disabled={
                                !canSubmitOverride(
                                  overrideReason,
                                  lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL),
                                  numConsulted,
                                )
                                  ? "true"
                                  : undefined
                              }
                              onClick={
                                !canSubmitOverride(
                                  overrideReason,
                                  lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL),
                                  numConsulted,
                                )
                                  ? ignoreUnavailableActivation
                                  : undefined
                              }
                              aria-describedby={
                                !canSubmitOverride(
                                  overrideReason,
                                  lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL),
                                  numConsulted,
                                )
                                  ? `ward-override-submit-reason-${activeMovement.id}`
                                  : undefined
                              }
                              title={
                                !canSubmitOverride(
                                  overrideReason,
                                  lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL),
                                  numConsulted,
                                )
                                  ? OVERRIDE_SUBMIT_UNAVAILABLE_REASON
                                  : undefined
                              }
                              data-testid={`ward-override-submit-${activeMovement.id}`}
                            >
                              Record reason and continue
                            </button>
                            {!canSubmitOverride(
                              overrideReason,
                              lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL),
                              numConsulted,
                            ) ? (
                              <span id={`ward-override-submit-reason-${activeMovement.id}`} className="sr-only">
                                {OVERRIDE_SUBMIT_UNAVAILABLE_REASON}
                              </span>
                            ) : null}
                          </fieldset>
                        </form>
                      ) : null}

                      {/* Phone (v10): Decline and Accept each open a bottom sheet first. */}
                      {isPhone ? (
                        <>
                          <PhoneSheet
                            open={declineOpen && !blocked}
                            onClose={() => toggleDecline(activeMovement.id)}
                            title="Decline this request"
                            description="Choose a reason. The referrer sees it."
                            height="tall"
                            secondary={{ label: "Back", onAction: () => toggleDecline(activeMovement.id) }}
                            primary={{
                              label: declinePending ? "Confirming decline…" : "Confirm decline",
                              disabledReason: declinePending ? "Waiting for confirmation" : undefined,
                              onAction: () => confirmDecline(activeMovement.id),
                            }}
                            data-testid={`ward-decline-sheet-${activeMovement.id}`}
                          >
                            <div className={styles.phoneSheetScope}>
                              <fieldset className={styles.phoneDeclineFieldset} disabled={declinePending}>
                                <legend className={styles.phoneSheetLabel}>Decline reason</legend>
                                {declineNudge && !canSubmitDecline(declineReason) ? (
                                  <p className={styles.phoneSheetNudge} role="alert">
                                    Choose a reason to confirm the decline.
                                  </p>
                                ) : null}
                                {DECLINE_REASONS.map((reason) => (
                                  <label key={reason} className={styles.phoneRadioRow}>
                                    <input
                                      type="radio"
                                      name={`decline-reason-${activeMovement.id}`}
                                      value={reason}
                                      checked={declineReason === reason}
                                      onChange={() => setDeclineReason(reason)}
                                    />
                                    <span>{declineReasonLabel(reason)}</span>
                                  </label>
                                ))}
                              </fieldset>
                              <div className={styles.phoneWaitlist}>
                                <div className={styles.phoneWaitlistHead}>
                                  <StatusGlyph tone="info" size={10} />
                                  <span className={styles.phoneFoldText}>
                                    <span className={styles.phoneFoldTitle}>Accept to the waitlist instead?</span>
                                    <span className={styles.phoneFoldLine}>
                                      The bed request stays open and this ward is next when a bed frees.
                                    </span>
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className={buttonClass({ variant: "sec", size: "md" })}
                                  onClick={() => {
                                    toggleDecline(activeMovement.id);
                                    setPhoneSheet("accept");
                                  }}
                                >
                                  Accept in principle
                                </button>
                              </div>
                            </div>
                          </PhoneSheet>
                          <PhoneSheet
                            open={phoneSheet === "accept" && !blocked}
                            onClose={() => setPhoneSheet(null)}
                            title="Accept in principle"
                            description={`This patient · ${activeMovement.cohort}, ${activeMovement.security.toLowerCase()}`}
                            secondary={{ label: "Cancel", onAction: () => setPhoneSheet(null) }}
                            primary={{
                              label: "Accept in principle",
                              onAction: () => {
                                setPhoneSheet(null);
                                handleAccept(activeMovement.id);
                              },
                            }}
                            data-testid={`ward-accept-sheet-${activeMovement.id}`}
                          >
                            <div className={styles.phoneSheetScope}>
                              <dl className={styles.phoneAcceptFacts}>
                                <div>
                                  <dt>Patient</dt>
                                  <dd>This patient</dd>
                                </div>
                                <div>
                                  <dt>Ward</dt>
                                  <dd>{unit.name}</dd>
                                </div>
                                <div>
                                  <dt>Bed</dt>
                                  <dd>{capacity.available > 0 ? "Ready now" : "Allocatable"}</dd>
                                </div>
                              </dl>
                              <div className={styles.phoneSheetField}>
                                <span className={styles.phoneSheetFieldLabel} id={`ward-hold-${activeMovement.id}`}>
                                  Bed hold
                                </span>
                                <div
                                  className={styles.phoneSegment}
                                  role="group"
                                  aria-labelledby={`ward-hold-${activeMovement.id}`}
                                >
                                  {[
                                    ["120", "120 minutes, standard"],
                                    ["180", "180 minutes, extra travel"],
                                  ].map(([value, label]) => (
                                    <button
                                      key={value}
                                      type="button"
                                      aria-pressed={holdDuration === value}
                                      onClick={() => setHoldDuration(value ?? "120")}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <label className={styles.phoneSheetField}>
                                <span className={styles.phoneSheetFieldLabel}>Receiving nurse unit manager</span>
                                <input
                                  type="text"
                                  className={styles.phoneSheetInput}
                                  defaultValue={`NUM ${unit.name}`}
                                />
                              </label>
                              <p className={styles.phoneSheetNote}>
                                Bed hold and nurse unit manager are not saved. Not wired in this prototype.
                              </p>
                              <p className={styles.phoneSheetNote}>
                                <StatusGlyph tone="neutral" size={8} />
                                Acceptance in principle holds a place. Nobody is moved and no transport is booked.
                              </p>
                            </div>
                          </PhoneSheet>
                        </>
                      ) : null}

                      {/* Inline Decline Form */}
                      {declineOpen && !blocked && !isPhone ? (
                        <form
                          className={styles.declineForm}
                          onSubmit={(event) => submitDecline(event, activeMovement.id)}
                          data-testid={`ward-decline-form-${activeMovement.id}`}
                        >
                          <fieldset className={styles.declineFieldset} disabled={declinePending}>
                            <legend className={styles.declineLegend}>Decline reason for this patient</legend>
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
                            aria-disabled={declinePending || !canSubmitDecline(declineReason) ? "true" : undefined}
                            onClick={
                              declinePending || !canSubmitDecline(declineReason)
                                ? ignoreUnavailableActivation
                                : undefined
                            }
                            aria-describedby={
                              !canSubmitDecline(declineReason)
                                ? `ward-decline-submit-reason-${activeMovement.id}`
                                : undefined
                            }
                            title={!canSubmitDecline(declineReason) ? DECLINE_SUBMIT_UNAVAILABLE_REASON : undefined}
                            className={`${styles.btn} ${styles.btnDanger}`}
                          >
                            {declinePending ? "Confirming decline…" : "Confirm decline"}
                          </button>
                          {!canSubmitDecline(declineReason) ? (
                            <span id={`ward-decline-submit-reason-${activeMovement.id}`} className="sr-only">
                              {DECLINE_SUBMIT_UNAVAILABLE_REASON}
                            </span>
                          ) : null}
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
                            if (isPhone) {
                              setPhoneSheet("accept");
                              return;
                            }
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
            {phoneFold(
              "capacity",
              "Confirm your beds",
              `Allocatable ${unit.allocatable.value} · ${durMinutes(Math.max(0, now - unit.allocatable.confirmedAt))} since confirmed`,
              unit.allocatable.value,
              <section className={styles.panel} data-answer-panel="capacity" aria-label="Confirm your beds">
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
                      It is not offered until someone opens the bed and taps Ready.
                    </p>
                  ) : null}
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
                        onChange={(next) =>
                          setCapacityDraft({ unitId, revision: capacityRevision, value: String(next) })
                        }
                      />
                      <button
                        type="submit"
                        data-testid="ward-capacity-submit"
                        // Secondary: Accept in principle is the page's one primary (device audit).
                        className={styles.btn}
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
              </section>,
            )}

            {/* Unit Bed Map Census */}
            {phoneFold(
              "census",
              "Census",
              `${states.occupied} occupied · ${states.ready} ready · ${states.pulled} pulled · ${states.closed} closed`,
              unit.beds,
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
                          if (!isVacant) {
                            ignoreUnavailableActivation(e);
                            return;
                          }
                          if (activeMovement) {
                            openerRef.current = e.currentTarget;
                            setAcceptModalOpen(true);
                          }
                        }}
                        aria-label={`Bed ${bedNum} ${statusLabel}`}
                        aria-describedby={isVacant ? undefined : `ward-answer-bed-reason-${unit.id}`}
                        title={isVacant ? undefined : "Only a ready bed can take a request"}
                        aria-disabled={!isVacant ? "true" : undefined}
                      >
                        <span className={styles.bedNum}>{bedNum}</span>
                        <span>{statusLabel}</span>
                      </button>
                    );
                  })}
                </div>
                {/* The reason the greyed beds give (a disabled control always says why). */}
                <p id={`ward-answer-bed-reason-${unit.id}`} className={styles.bedGridReason}>
                  Only a ready bed can take a request.
                </p>
                {/* Shift milieu and staffing balance. The ratio ("1 : 3 (Compliant)"), the shift name and a
                  65/35 male-to-female split of the occupied count were typed in here (25 September
                  2026 review). Ward Flow holds no staffing figures and this screen counts no one's
                  sex, so both rows say so rather than show a number. */}
                <div className={styles.milieuList}>
                  <div className={styles.milieuRow}>
                    <span className={styles.milieuLabel}>Not recorded</span>
                    <span className={styles.milieuValue}>nurse ratio, sex mix</span>
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
              </section>,
            )}

            {/* Recent Answers (History Ledger) */}
            {phoneFold(
              "history",
              "Recent answers",
              recentAnswers[0]
                ? `${recentAnswers[0].outcome}${recentAnswers[0].at !== undefined ? ` at ${formatInstantWithDay(recentAnswers[0].at, now)}` : ""}`
                : "None recorded yet",
              recentAnswers.length,
              <section className={styles.panel} data-answer-panel="history" aria-label="Recent answers">
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>Recent answers</h2>
                </div>
                <div className={styles.historyPanelBody}>
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
              </section>,
            )}
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
                  // No identity before acceptance (owner, 26 Sept 2026), so the tier and referral time tell
                  // two waiting requests from the same cohort apart (D-39).
                  value={`Incoming patient (${activeMovement.cohort}), Tier ${activeMovement.urgency}${activeMovement.referredAt === undefined ? "" : `, referred ${formatInstantWithDay(activeMovement.referredAt, now)}`}`}
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
              <p className={styles.formNote}>
                Bed hold and nurse unit manager are not saved. Not wired in this prototype.
              </p>
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
        note={`Scoped to ${unit.name} · Bed decisions remain human-confirmed · Not approved for clinical use`}
      />
    </div>
  );
}
