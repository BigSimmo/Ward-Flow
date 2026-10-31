"use client";

import { WardNotFoundBody } from "@/components/ward-management/shell/ward-not-found";
import { ChevronLeft, ChevronRight, ChevronRight as RowChevron, ShieldCheck, UserRound } from "lucide-react";
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
  checkedGates,
  eligibility,
  gateMark,
  wardFacingGateDetail,
} from "@/components/ward-management/ward-eligibility";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import { formatWardOccupancy, wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useWardModalFocus, useWardPageScrollLock } from "@/components/ward-management/ward-modal-focus";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { HIGH_ACUITY_STAFFING_REFUSAL, OVERRIDE_REASON_REQUIRED } from "@/components/ward-management/ward-flow-reducer";
import {
  EXTRA_TRAVEL_HOLD_MINUTES,
  MOVEMENT_DECLINE_REASONS,
  type DeclineReason,
  type Movement,
  type Unit,
} from "@/components/ward-management/ward-model";
import { OVERRIDE_REASONS, type OverrideReason } from "@/components/ward-management/ward-change-reasons";
import { WARD_GATE_LABELS, wardSafeRejectionReason } from "./ward-rejection-text";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { recordedMovementMedicalClearance } from "@/components/ward-management/ward-medical-clearance";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";

import {
  Hero,
  HeroStat,
  LiveChip,
  OccupancyRing,
  Stepper,
  StatusGlyph,
  buttonClass,
  DisabledReason,
  durMinutes,
  useIsPhone,
  PhoneSheet,
  ShowMoreRow,
  SrOnly,
} from "@/components/wf";
import { CAPACITY_FIGURE_LABELS } from "@/components/ward-management/ward-morning-rollup";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import styles from "./ward-answer-view.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { DeclineFailureNote, useAnswerToast, useAwaitingFocus, useDeclineFailure } from "./ward-answer-feedback";
import {
  canSubmitDecline,
  canSubmitOverride,
  DECLINE_SUBMIT_UNAVAILABLE_REASON,
  OVERRIDE_SUBMIT_UNAVAILABLE_REASON,
} from "./ward-home-tab";
import { declineTargetLeftNote } from "./decline-target-left";
import { WardAcceptDialog } from "./ward-answer-accept-dialog";
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";
import { isConstantObservation, observationSummary } from "@/components/ward-management/ward-observation";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";

const ANSWER_ALERT_LINE = CLINICAL_VALUES.bedAlertLine.value; // the hero ring's signed alert line

const WARD_ACTION_REJECTION_LABELS: Record<string, string> = {
  ACCEPT_IN_PRINCIPLE: "Accept in principle",
  PULL_PATIENT: "Pull the bed",
  PATIENT_ARRIVED: "Confirm arrival",
};

// Owner, 26 Sept 2026: the patient's name, not the WF journey number.
function referralAnswerBlocked(movement: Movement, unit: Unit, who?: string): string | undefined {
  if (movement.acceptedUnitId !== undefined && movement.acceptedUnitId !== unit.id) {
    return `${who ?? "This patient"} was already accepted by another ward.`;
  }
  return undefined;
}

export interface WardAnswerViewProps {
  unitId: string;
  /** The request to open on, when a link names one; otherwise the longest wait. */
  initialMovementId?: string;
}

/** A decline reason in the one list's wording (D-78); a value off the list shows as written. */
/** Why Accept waits: the pull time limit starts with nothing chosen (Josh, 31 Oct 2026). */
const HOLD_CHOICE_REASON = "Choose a pull time limit first";

/** The census squares and their key are filled by bed state, with the same colour for each. */
const CENSUS_FILL = {
  ready: styles.fillReady,
  pulled: styles.fillPulled,
  closed: styles.fillClosed,
  occupied: styles.fillOccupied,
} as const;

function declineReasonLabel(reason: DeclineReason): string {
  return DECLINE_REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

/**
 * Redesign (approved by Josh, 31 Oct 2026): with nothing to answer the Bed request panel is one line;
 * the Census squares are filled by state (ready, pulled, closed, occupied) with a key of the same
 * counts. Confirm your beds keeps its stepper and Confirm; Recent answers and "writes to this ward
 * only" stay as they are.
 */
export function WardAnswerView({ unitId, initialMovementId }: WardAnswerViewProps) {
  const [, startTransition] = useTransition();
  const {
    movements,
    units,
    bedReleases,
    leaveBeds,
    admissions,
    dispatch,
    rejections,
    resolvePatientIdentity,
    configuration,
  } = useWardFlowSelect(
    "movements",
    "units",
    "bedReleases",
    "leaveBeds",
    "admissions",
    "dispatch",
    "rejections",
    "resolvePatientIdentity",
    "configuration",
  );
  const now = useWardFlowClock();
  const raise = useWardRaise("ward");
  const unit = units.find((candidate) => candidate.id === unitId);

  // Audit 1, Josh 20 Oct (CS-08): held by journey id, never list position; `index` is where to land after answering.
  // Notices option A (22 Oct 2026): a Notices row names its request, so the view opens on that patient.
  const [answerSelection, setAnswerSelection] = useState<{ id?: string; index: number; name?: string }>({
    id: initialMovementId,
    index: 0,
  });
  const [answeredHereId, setAnsweredHereId] = useState<string>();
  // Phone (v10): its own layout. The facts show four until asked, the ISBAR summary and the
  // ward's gates fold, and the beds, census and answers are rows that open in place.
  const isPhone = useIsPhone();
  const [showAllFacts, setShowAllFacts] = useState(false);
  // Phone (v10): the gates, beds, census and answers rows each open their panel as a bottom sheet.
  const [phoneSheet, setPhoneSheet] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState<OverrideReason | undefined>(undefined);
  const [numConsulted, setNumConsulted] = useState(false);
  const [declineOpenFor, setDeclineOpenFor] = useState<string | undefined>(undefined);
  useHoldOpenForm(declineOpenFor !== undefined); // Audit CS3-01: held from opening; one referral at a time.
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

  // Modal & interactive state. The accept dialog belongs to one journey id (CS-08).
  const [acceptModalFor, setAcceptModalFor] = useState<string>();
  // D-75 item 5: the accepting ward can ask for the extra-travel bed hold (`ACCEPT_IN_PRINCIPLE.extendedHold`).
  // The choice belongs to the request it was made for (CS-08), so it never carries to the next one.
  const [holdChoice, setHoldChoice] = useState<{ movementId: string; extended: boolean }>();
  const extendedHoldFor = (movementId: string | undefined) =>
    movementId !== undefined && holdChoice?.movementId === movementId && holdChoice.extended;
  const chooseHold = (movementId: string, extended: boolean) => setHoldChoice({ movementId, extended });
  // Nothing pre-selected (Josh, 31 Oct 2026): Accept waits until the ward picks a pull time limit.
  const holdChosenFor = (movementId: string) => holdChoice?.movementId === movementId;
  const holdChoices = [
    { extended: false, label: `${configuration.pullHoldMinutes} minutes, standard` },
    {
      extended: true,
      label: `${configuration.pullHoldMinutes + EXTRA_TRAVEL_HOLD_MINUTES} minutes, extra travel`,
    },
  ];
  const { toastMessage, setToastMessage, triggerToast, toastDeclined } = useAnswerToast();
  const decline = useDeclineFailure(triggerToast);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const declineFormRef = useRef<HTMLFormElement | null>(null);

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

  // Opening Decline moves focus to the first reason, which also scrolls the reasons into view.
  useEffect(() => {
    if (!declineOpenFor || isPhone) return;
    declineFormRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
  }, [declineOpenFor, isPhone]);

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
  const { awaitingRef, markAccepted } = useAwaitingFocus(incoming);
  const acceptModalMovement = incoming.find((movement) => movement.id === acceptModalFor);
  const acceptModalOpen = acceptModalMovement !== undefined;
  useWardModalFocus(acceptModalOpen, modalRef, () => {
    setAcceptModalFor(undefined);
    setHoldChoice(undefined);
    (openerRef.current ?? triggerRef.current)?.focus();
  });
  // Hooks run before the early return below; the accept sheet only opens on a ward's incoming answer.
  useWardPageScrollLock(acceptModalOpen);
  const recentAnswers = useMemo(
    () =>
      !unit
        ? []
        : movements
            .flatMap((movement) => {
              const wardAnswers: Array<{
                key: string;
                movementId: string;
                outcome: "Accepted in principle" | "Declined";
                at?: Instant;
                reason?: DeclineReason;
              }> = [];

              if (movement.acceptedUnitId === unit.id) {
                wardAnswers.push({
                  key: `${movement.id}-accepted`,
                  movementId: movement.id,
                  outcome: "Accepted in principle",
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
            list={{ href: "/ward-flow/wards", label: "All wards" }}
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
  // The one occupancy figure (Occupied + Pulled, `ward-occupancy.ts`), the same as the Ward page.
  const occupancy = wardOccupancy([currentUnit], admissions, bedReleases);
  // Owner ruling 2026-09-05: "ready" does not subtract a bed being made ready, so this sentence (the
  // reducer's own `bedsPendingPreparation`) keeps a coordinator from pulling into a bed not yet made.
  const pendingPreparation = bedsPendingPreparation(currentUnit.id, bedReleases);
  const heldIndex = incoming.findIndex((movement) => movement.id === answerSelection.id);
  const activeAnswerIndex =
    heldIndex >= 0 ? heldIndex : Math.min(answerSelection.index, Math.max(incoming.length - 1, 0));
  // Audit 24-1 D-01: a shown or linked request that leaves elsewhere keeps its place (no swap).
  const answeredHere = answerSelection.id === answeredHereId && lastActionRejection?.movementId !== answeredHereId;
  const linked = answerSelection.name ? undefined : movements.find((m) => m.id === (initialMovementId ?? null));
  const leftName = answerSelection.name ?? (linked && resolvePatientIdentity(linked).formalName);
  const selectionLeft = heldIndex < 0 && leftName !== undefined && !answeredHere && incoming.length > 0;
  const activeMovement = selectionLeft ? undefined : incoming[activeAnswerIndex];
  const pick = (index: number, movement = incoming[index]) =>
    setAnswerSelection({ id: movement?.id, index, name: movement && resolvePatientIdentity(movement).formalName });
  if (activeMovement && answerSelection.id !== activeMovement.id) pick(activeAnswerIndex, activeMovement);
  const selectAnswer = (index: number) => {
    setAnsweredHereId(undefined);
    pick(index);
    setHoldChoice(undefined);
  };
  // CS-08: the request an accept dialog or sheet was opened for has left (answered or withdrawn
  // elsewhere), so it closes rather than confirm whoever now sits in its place.
  const phoneAcceptLeft = phoneSheet === "accept" && answerSelection.id !== undefined && heldIndex < 0;
  if ((acceptModalFor !== undefined && !acceptModalOpen) || phoneAcceptLeft) {
    setAcceptModalFor(undefined);
    if (phoneAcceptLeft) setPhoneSheet(null);
    setToastMessage({ message: "This request was answered or withdrawn.", warning: true });
  }
  // A4-10 (H-0121): a decline form goes with its row and says nothing; the empty cards say why.
  const declineLeftNote = declineTargetLeftNote(declineOpenFor, incoming, recentAnswers, (id) =>
    movements.some((m) => m.id === id && m.withdrawnReferrals.some((entry) => entry.unitId === currentUnit.id)),
  );
  function openPhoneAccept() {
    selectAnswer(activeAnswerIndex);
    setHoldChoice(undefined);
    setPhoneSheet("accept");
  }

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
    setPriorRejectionCount(rejections.length);
    setAnsweredHereId(movementId);
    decline.clear();
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
        toastDeclined(declineReason);
      } else {
        setAnsweredHereId(undefined);
        decline.fail(movementId, outcome?.message);
      }
    } catch {
      setAnsweredHereId(undefined);
      decline.fail(movementId);
    } finally {
      declinePendingRef.current = false;
      setDeclinePending(false);
    }
  }

  function handleAccept(movementId: string, withExtendedHold = false) {
    markAccepted(0);
    setPriorRejectionCount(rejections.length);
    setAnsweredHereId(movementId);
    const unitIdHere = currentUnit.id;
    const accepted = incoming.find((movement) => movement.id === movementId);
    // v10 pass 3: Accept, then Undo on the toast (`UNDO_ACCEPT_IN_PRINCIPLE`, this ward's own).
    // Owner, 26 Sept 2026: no WF journey number in a person-facing toast; it names the person (24-1 B-08).
    runStep(
      {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        now,
        movementId,
        unitId: unitIdHere,
        actingUnitId: unitIdHere,
        ...(withExtendedHold ? { extendedHold: true as const } : {}),
      },
      {
        success: `Accepted ${accepted ? `${resolvePatientIdentity(accepted).formalName} ` : ""}in principle.`,
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
    setAcceptModalFor(undefined);
    // The choice stays, keyed to this request, so an override reason sends it again.
  }

  function submitOverride(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!overrideReason || !lastActionRejection) return;
    const attempted = lastActionRejection.attempted;
    if (attempted !== "ACCEPT_IN_PRINCIPLE" && attempted !== "PULL_PATIENT") return;

    const isAcuityRefusal = lastActionRejection.reason.includes(HIGH_ACUITY_STAFFING_REFUSAL);
    if (!canSubmitOverride(overrideReason, isAcuityRefusal, numConsulted)) return;
    setPriorRejectionCount(rejections.length);
    setAnsweredHereId(movementId);

    if (attempted === "ACCEPT_IN_PRINCIPLE") {
      raise("ACCEPT_IN_PRINCIPLE", {
        movementId,
        unitId: currentUnit.id,
        actingUnitId: currentUnit.id,
        overrideReason,
        ...(extendedHoldFor(movementId) ? { extendedHold: true as const } : {}),
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
        pass: checkedGates(phoneGatesVerdict.gates).filter((gate) => gate.pass).length,
        total: checkedGates(phoneGatesVerdict.gates).length,
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

  // Fix plan item 10: incoming patients on a constant observation level, accepted here and still open
  // (audit 24-4 NA2-12: a closed journey is no longer incoming).
  const activeSpeciallingCount = movements.filter(
    (m) => isOpen(m) && isConstantObservation(m.observation) && m.acceptedUnitId === unit.id,
  ).length;

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
                : // Round 2: the Ready figure below carries the bed count, so the line keeps only the last answer.
                  recentAnswers[0]?.at !== undefined
                  ? `Last answer at ${formatInstantWithDay(recentAnswers[0].at, now)}`
                  : undefined
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
                      selectAnswer(activeAnswerIndex - 1);
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
                      selectAnswer(activeAnswerIndex + 1);
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
            ref={awaitingRef}
            aria-label="Awaiting your answer"
            className={
              activeMovement
                ? styles.answerSplit
                : incoming.length === 0 && !isPhone
                  ? `${styles.panel} ${styles.allAnsweredPanel}`
                  : styles.panel
            }
            data-empty={incoming.length === 0}
          >
            {activeMovement || isPhone || incoming.length === 0 ? null : (
              <div className={styles.panelHeader}>
                <div className={styles.panelHeaderLeft}>
                  <h2 className={styles.panelTitle}>Bed request</h2>
                </div>
                <span className={styles.panelSub}>{selectionLeft ? "choose a request" : "none waiting"}</span>
              </div>
            )}

            {/* Round 2: the title already says "Nothing to answer", so the notice is one line on every
                device and says only what happens next. */}
            {incoming.length === 0 ? (
              <div className={styles.allAnswered} data-testid="ward-answer-all-answered">
                <p className={styles.allAnsweredLine}>
                  <StatusGlyph tone="success" size={10} />
                  <span>Requests land here as they are sent.</span>
                </p>
                {declineLeftNote ? <p role="status">{declineLeftNote}</p> : null}
              </div>
            ) : selectionLeft ? (
              <div className={styles.sbarCard} data-testid="ward-answer-selection-left">
                <p role="status">{leftName}&rsquo;s request was answered or withdrawn elsewhere.</p>
                <button
                  type="button"
                  className={buttonClass({ variant: "sec", size: "sm" })}
                  onClick={() => selectAnswer(activeAnswerIndex)}
                >
                  Show request {activeAnswerIndex + 1} of {incoming.length}
                </button>
              </div>
            ) : activeMovement ? (
              (() => {
                // Owner, 26 Sept 2026: no WF journey number. Josh, 22 Oct 2026: the ward does see the
                // patient's name and UMRN before it answers, never where else they were referred.
                const blocked = referralAnswerBlocked(activeMovement, unit);
                // The desk's one-step accept waits for a pull time limit; the phone sheet asks for its own.
                const holdPending = !isPhone && !blocked && !holdChosenFor(activeMovement.id);
                const notice = restrictionNotice(activeMovement, unit);
                const eligibilityIssue = eligibilityWarning(activeMovement, unit, now);
                const eligibilityVerdict = eligibility(activeMovement, unit, now);
                const failedGateCount = eligibilityVerdict.gates.filter((gate) => !gate.pass).length;
                // Information-only gates (acuity, specialling) are listed but never counted as passing.
                const checkedGateCount = checkedGates(eligibilityVerdict.gates).length;
                const infoGateCount = eligibilityVerdict.gates.length - checkedGateCount;
                const declineOpen = declineOpenFor === activeMovement.id;
                // FD-23: a ward-only view reads no referral records, so the shared reader gets none and
                // returns the movement's own recorded clearance (recording one writes it here too).
                const clearance = recordedMovementMedicalClearance(activeMovement, []);
                // Audit 1, Josh 20 Oct (CS-02, NB-1): recorded facts only; absent reads "Not recorded".
                const sbarSections = (
                  <>
                    <div className={styles.sbarSection}>
                      <span className={styles.sbarTag}>Situation</span>
                      <div className={styles.sbarContent}>
                        {activeMovement.cohort} cohort. {activeMovement.security === "Secure" ? "Secure" : "Open"} bed
                        requested. Legal status: {activeMovement.legalStatus}
                        {activeMovement.legalForm ? `, ${legalFormName(activeMovement.legalForm)}` : ""}.
                      </div>
                    </div>

                    <div className={styles.sbarSection}>
                      <span className={styles.sbarTag}>Assessment</span>
                      <div className={styles.sbarContent} data-testid="ward-answer-assessment">
                        Medical clearance:{" "}
                        {clearance === undefined
                          ? "Not recorded"
                          : clearance.cleared
                            ? `Medically cleared at ${formatInstantWithDay(clearance.at, now)}`
                            : "Recorded as not cleared"}
                        . Observation level: {observationSummary(activeMovement.observation)}. This ward&rsquo;s gates:{" "}
                        {checkedGateCount - failedGateCount} of {checkedGateCount} checks met
                        {infoGateCount > 0 ? `; ${infoGateCount} for information only` : ""}.
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
                              {/* Josh, 22 Oct 2026: a ward sees who is coming before it answers. */}
                              <span className={styles.phoneFoldTitle}>
                                {resolvePatientIdentity(activeMovement).formalName}
                              </span>
                              <span className={styles.phonePatientLine}>
                                {resolvePatientIdentity(activeMovement).umrn}
                              </span>
                            </span>
                          </div>
                        ) : null}
                        {isPhone ? (
                          <div className={styles.phonePatientChips}>
                            <span className={styles.phonePatientChip}>
                              <ShieldCheck size={14} aria-hidden="true" />
                              {activeMovement.legalStatus}
                            </span>
                            {isConstantObservation(activeMovement.observation) ? (
                              <span className={styles.phonePatientChip}>
                                {observationSummary(activeMovement.observation)}
                              </span>
                            ) : null}
                            {activeMovement.highAcuity ? (
                              <span className={styles.phonePatientChip}>High acuity</span>
                            ) : null}
                          </div>
                        ) : (
                          <div className={styles.patientDossierBanner}>
                            <div>
                              <div className={styles.patientNameLine}>
                                {resolvePatientIdentity(activeMovement).formalName} &middot;{" "}
                                {resolvePatientIdentity(activeMovement).umrn}
                              </div>
                              <div className={styles.patientMetaLine}>
                                Cohort: {activeMovement.cohort} &bull; Security: {activeMovement.security} &bull; Sex:{" "}
                                {activeMovement.sex} &bull; {elapsedLabel(activeMovement, now)}
                              </div>
                            </div>
                            <div className={styles.patientDossierBadges}>
                              <span className={styles.badge} data-tone="danger">
                                {activeMovement.legalStatus}
                              </span>
                              {isConstantObservation(activeMovement.observation) ? (
                                <span className={styles.badge} data-tone="warn">
                                  {observationSummary(activeMovement.observation)}
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
                            <dt>Observation level</dt>
                            <dd>{observationSummary(activeMovement.observation)}</dd>
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
                          <ShowMoreRow
                            expanded={showAllFacts}
                            controls="ward-answer-facts"
                            onClick={() => setShowAllFacts((open) => !open)}
                          >
                            {showAllFacts
                              ? "Show fewer facts"
                              : `Show all ${activeMovement.gender === activeMovement.sex ? 8 : 9} facts`}
                          </ShowMoreRow>
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
                              {checkedGateCount - failedGateCount} of {checkedGateCount} pass
                            </span>
                          </div>
                          <ul>
                            {eligibilityVerdict.gates.map((gate) => (
                              <li key={gate.gate} data-pass={gate.pass} data-mark={gateMark(gate)}>
                                <span className={styles.answerGateMark} aria-hidden="true">
                                  {gateMark(gate) === "info" ? (
                                    "i"
                                  ) : gate.pass ? (
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
                                  {gateMark(gate) === "info" ? "For information" : gate.pass ? "Pass" : "Does not pass"}
                                </strong>
                              </li>
                            ))}
                          </ul>
                        </section>,
                        checkedGateCount - failedGateCount,
                        checkedGateCount,
                      )}

                      {notice ? (
                        <span
                          className={`${styles.badge} ${styles.noticeBadge}`}
                          data-testid={`ward-restriction-notice-${activeMovement.id}`}
                          data-level={notice.level}
                          data-tone="warn"
                        >
                          {notice.text}
                        </span>
                      ) : null}

                      {eligibilityIssue ? (
                        <span
                          className={`${styles.badge} ${styles.noticeBadge}`}
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

                      <DeclineFailureNote failure={decline.failure} movementId={activeMovement.id} />

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
                              label: declinePending ? "Confirming decline…" : `Decline for ${answerSelection.name}`, // 24-7 CT-19
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
                                {MOVEMENT_DECLINE_REASONS.map((reason, index) => (
                                  <label key={reason} className={styles.phoneRadioRow}>
                                    <input
                                      type="radio"
                                      name={`decline-reason-${activeMovement.id}`}
                                      value={reason}
                                      checked={declineReason === reason}
                                      onChange={() => setDeclineReason(reason)}
                                      // Visual desk, 22 Oct 2026: the sheet opens on the reasons, not on ×.
                                      data-sheet-autofocus={
                                        (declineReason ? declineReason === reason : index === 0) ? "true" : undefined
                                      }
                                    />
                                    <span>{declineReasonLabel(reason)}</span>
                                  </label>
                                ))}
                              </fieldset>
                              <div className={styles.phoneWaitlist}>
                                <div className={styles.phoneWaitlistHead}>
                                  <StatusGlyph tone="info" size={10} />
                                  <span className={styles.phoneFoldText}>
                                    <span className={styles.phoneFoldTitle}>Accept to the waiting list instead?</span>
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
                                    openPhoneAccept();
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
                              disabledReason: holdChosenFor(activeMovement.id) ? undefined : HOLD_CHOICE_REASON,
                              onAction: () => {
                                setPhoneSheet(null);
                                handleAccept(activeMovement.id, extendedHoldFor(activeMovement.id));
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
                                  <dd>{capacity.available > 0 ? "Ready now" : "Not ready yet"}</dd>
                                </div>
                              </dl>
                              <div className={styles.phoneSheetField}>
                                <span className={styles.phoneSheetFieldLabel} id={`ward-hold-${activeMovement.id}`}>
                                  Pull time limit
                                </span>
                                <div
                                  className={styles.phoneSegment}
                                  role="group"
                                  aria-labelledby={`ward-hold-${activeMovement.id}`}
                                >
                                  {holdChoices.map((choice) => (
                                    <button
                                      key={choice.label}
                                      type="button"
                                      aria-pressed={
                                        holdChosenFor(activeMovement.id) &&
                                        extendedHoldFor(activeMovement.id) === choice.extended
                                      }
                                      onClick={() => chooseHold(activeMovement.id, choice.extended)}
                                    >
                                      {choice.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <p className={styles.phoneSheetNote}>
                                <StatusGlyph tone="neutral" size={8} />
                                Acceptance in principle holds a place. Nobody is moved and no transport is booked.
                              </p>
                            </div>
                          </PhoneSheet>
                        </>
                      ) : null}

                      {/* Decision Action Controls */}
                      {/* DA-19 (design audit, 20 Oct 2026): the not-wired "Ask a question" is gone. */}
                      <div className={styles.decisionArea}>
                        {/* D-75 item 5: the desk's one-step accept offers the same hold choice as the phone sheet. */}
                        {isPhone || blocked ? null : (
                          <label className={styles.holdInline} htmlFor={`ward-accept-hold-${activeMovement.id}`}>
                            <span className={styles.formLabel}>Pull time limit</span>
                            <select
                              id={`ward-accept-hold-${activeMovement.id}`}
                              className={styles.formSelect}
                              value={
                                holdChosenFor(activeMovement.id)
                                  ? extendedHoldFor(activeMovement.id)
                                    ? "extended"
                                    : "standard"
                                  : ""
                              }
                              onChange={(e) => chooseHold(activeMovement.id, e.target.value === "extended")}
                            >
                              <option value="" disabled>
                                Choose a time limit
                              </option>
                              {holdChoices.map((choice) => (
                                <option key={choice.label} value={choice.extended ? "extended" : "standard"}>
                                  {choice.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
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
                        {holdPending ? (
                          <DisabledReason id={`ward-accept-hold-reason-${activeMovement.id}`}>
                            {HOLD_CHOICE_REASON}
                          </DisabledReason>
                        ) : null}
                        <button
                          type="button"
                          data-testid={`ward-accept-${activeMovement.id}`}
                          aria-disabled={blocked || holdPending ? "true" : undefined}
                          aria-describedby={
                            blocked
                              ? `ward-accept-unavailable-${activeMovement.id}`
                              : holdPending
                                ? `ward-accept-hold-reason-${activeMovement.id}`
                                : undefined
                          }
                          title={blocked ?? undefined}
                          className={buttonClass({ variant: "pri", size: "sm" })}
                          onClick={() => {
                            if (blocked || holdPending) return;
                            if (isPhone) {
                              openPhoneAccept();
                              return;
                            }
                            handleAccept(activeMovement.id, extendedHoldFor(activeMovement.id));
                          }}
                        >
                          Accept in principle
                        </button>
                      </div>

                      {/* Inline Decline Form: below the buttons that open it, so the reasons appear in view (UX audit 21 Oct 2026). */}
                      {declineOpen && !blocked && !isPhone ? (
                        <form
                          ref={declineFormRef}
                          className={styles.declineForm}
                          onSubmit={(event) => submitDecline(event, activeMovement.id)}
                          data-testid={`ward-decline-form-${activeMovement.id}`}
                        >
                          <fieldset className={styles.declineFieldset} disabled={declinePending}>
                            <legend className={styles.declineLegend}>Decline reason for this patient</legend>
                            {MOVEMENT_DECLINE_REASONS.map((reason) => (
                              <label key={reason} className={styles.declineOption}>
                                <input
                                  type="radio"
                                  name={`decline-reason-${activeMovement.id}`}
                                  value={reason}
                                  checked={declineReason === reason}
                                  onChange={() => setDeclineReason(reason)}
                                />
                                {declineReasonLabel(reason)}
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
                            {declinePending ? "Confirming decline…" : `Decline for ${answerSelection.name}`}
                          </button>
                          {!canSubmitDecline(declineReason) ? (
                            <span id={`ward-decline-submit-reason-${activeMovement.id}`} className="sr-only">
                              {DECLINE_SUBMIT_UNAVAILABLE_REASON}
                            </span>
                          ) : null}
                        </form>
                      ) : null}
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
              `Confirmed free ${unit.allocatable.value} · ${durMinutes(Math.max(0, now - unit.allocatable.confirmedAt))} since confirmed`,
              unit.allocatable.value,
              <section className={styles.panel} data-answer-panel="capacity" aria-label="Confirm your beds">
                <div className={styles.panelHeader}>
                  <h2 className={styles.panelTitle}>Confirm your beds</h2>
                </div>
                <div className={styles.capacityPanelBody}>
                  <dl className={styles.capacityFacts} aria-label={`Current bed facts for ${unit.name}`}>
                    {/* Round 2: Confirmed free leads (the form below sets it); Ready is the hero's word for
                        the bed board figure; the discharge figures use the app's labels, as they
                        count tomorrow too. */}
                    <div>
                      <dt>Confirmed free</dt>
                      <dd>{unit.allocatable.value}</dd>
                    </div>
                    <div>
                      <dt>Ready</dt>
                      <dd>{states.ready}</dd>
                    </div>
                    <div>
                      <dt>Empty</dt>
                      <dd>{unit.empty.value}</dd>
                    </div>
                    <div>
                      <dt>{CAPACITY_FIGURE_LABELS.confirmedToday}</dt>
                      <dd>{breakdown.confirmedToday}</dd>
                    </div>
                    <div>
                      <dt>{CAPACITY_FIGURE_LABELS.expectedToday}</dt>
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
                      Free beds now, for {unit.name}
                    </span>
                    <div className={styles.capacityRow}>
                      {/* v10: one control only, a stepper; no slider and no free number box. */}
                      <Stepper
                        value={Number(capacityValue) || 0}
                        min={0}
                        max={unit.beds}
                        noun="free beds"
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
                    } ${styles.cell} ${CENSUS_FILL[isVacant ? "ready" : isPulled ? "pulled" : isClosed ? "closed" : "occupied"]}`;
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
                            selectAnswer(activeAnswerIndex);
                            setHoldChoice(undefined);
                            setAcceptModalFor(activeMovement.id);
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
                {/* Redesign: a key to the filled squares, with the same counts the hero shows. */}
                <ul className={styles.legend} aria-label="Census key">
                  {(
                    [
                      ["ready", states.ready],
                      ["pulled", states.pulled],
                      ["closed", states.closed],
                      ["occupied", states.occupied],
                    ] as const
                  ).map(([state, count]) => (
                    <li key={state} className={styles.legendItem}>
                      <span className={`${styles.swatch} ${CENSUS_FILL[state]}`} aria-hidden="true" />
                      {BED_STATE_LABELS[state]} <b className={styles.legendCount}>{count}</b>
                    </li>
                  ))}
                </ul>
                {/* The reason the greyed beds give (a disabled control always says why). */}
                {/* Round 2: shown only while a request is open (it explains the greyed squares then);
                    otherwise it stays for the squares' spoken description. */}
                {activeMovement ? (
                  <p id={`ward-answer-bed-reason-${unit.id}`} className={styles.bedGridReason}>
                    Only a ready bed can take a request.
                  </p>
                ) : (
                  <SrOnly id={`ward-answer-bed-reason-${unit.id}`}>Only a ready bed can take a request.</SrOnly>
                )}
                {/* Shift milieu and staffing balance. The ratio ("1 : 3 (Compliant)"), the shift name and a
                  65/35 male-to-female split of the occupied count were typed in here (25 September
                  2026 review). Ward Flow holds no staffing figures and this screen counts no one's
                  sex, so both rows say so rather than show a number. */}
                {/* Round 2: the "Not recorded: nurse ratio, gender mix" row held nothing, and the expected
                    discharges figure lives once, in Confirm your beds. */}
                <div className={styles.milieuList}>
                  <div className={styles.milieuRow}>
                    <span className={styles.milieuLabel}>Constant observation</span>
                    <span className={styles.milieuValue}>{activeSpeciallingCount} active</span>
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
                          <span>{answer.reason ? declineReasonLabel(answer.reason) : "Accepted by this ward"}</span>
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

      {/* Accept in principle dialog, bound to the journey it was opened for (CS-08). WP-09 (Audit 1,
          Josh 20 Oct): the census cells are counts, not numbered beds, so no bed number is sent and
          the dialog says so rather than imply an allocation. */}
      {acceptModalMovement ? (
        <WardAcceptDialog
          movement={acceptModalMovement}
          patientName={resolvePatientIdentity(acceptModalMovement).formalName}
          unitName={unit.name}
          now={now}
          extended={extendedHoldFor(acceptModalMovement.id)}
          holdChoices={holdChoices}
          dialogRef={modalRef}
          onChooseHold={(extended) => chooseHold(acceptModalMovement.id, extended)}
          onCancel={() => {
            setAcceptModalFor(undefined);
            setHoldChoice(undefined);
            (openerRef.current ?? triggerRef.current)?.focus();
          }}
          onConfirm={() => {
            const opener = openerRef.current;
            handleAccept(acceptModalMovement.id, extendedHoldFor(acceptModalMovement.id));
            if (opener && document.body.contains(opener) && !opener.hasAttribute("disabled")) {
              opener.focus();
            } else {
              triggerRef.current?.focus();
            }
          }}
        />
      ) : null}

      {/* Action Toast */}
      {/* Outside a phone sheet's background inerting, so a failure is still said and Close still works while the decline sheet stays open. */}
      <div role="status" aria-live="polite" data-sheet-inert-skip="">
        {toastMessage ? (
          <div
            className={styles.toast}
            data-testid="ward-answer-toast"
            data-tone={toastMessage.warning ? "warning" : "success"}
          >
            <StatusGlyph tone={toastMessage.warning ? "warning" : "success"} size={10} />
            <span>{toastMessage.message}</span>
            {toastMessage.warning ? (
              <button
                type="button"
                className={styles.toastClose}
                data-testid="ward-answer-toast-close"
                onClick={() => setToastMessage(null)}
              >
                Close
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <WardPrototypeFooter
        testId="ward-unit-governance"
        note={`Scoped to ${unit.name} · Bed decisions remain human-confirmed · Not approved for clinical use`}
      />
    </div>
  );
}
