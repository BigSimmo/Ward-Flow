"use client";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { journeySentByKind } from "@/components/ward-management/ward-journey-sender";
import { journeySentByDesk } from "@/components/ward-management/ward-referral-sender";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, BedSingle, Check, Hospital, Info, ShieldCheck, Ambulance } from "lucide-react";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { wardRaise } from "../ward-flow-raise";
import {
  candidateReason,
  eligibility,
  gateMark,
  placementFit,
  readyBedsFor,
  staleCountWords,
} from "../ward-eligibility";
import { shortlistVerdict, stageCopy } from "../ward-derivations";
import { useSharedReadyLookup } from "../use-shared-ready";
import { legalFormName } from "../ward-legal-forms";
import { currentLegalPosition, FORM_RECORDED_ENDED } from "../ward-legal-form-progression";
import { typedClock } from "../ward-legal-time-as-typed";
import { CAD_TO_FOLLOW, cadNumberLine, cadNumberToFollow } from "../ward-cad-number";
import {
  MOVEMENT_STAGES,
  genderReviewNeeded,
  STEP_BACK_REASONS,
  stepBackReasonLabels,
  type Movement,
  type MovementStage,
  type StepBackReason,
  type TransportExceptionGap,
  type TransportExceptionReason,
} from "../ward-model";
import {
  GENDER_PLACEMENT_REASONS,
  type GenderPlacementReason,
  OVERRIDE_REASONS,
  type OverrideReason,
  RELEASE_PULL_REASONS,
  type ReleasePullReason,
  CANCEL_TRANSPORT_REASONS,
  type CancelTransportReason,
  changeReasonLabels,
} from "../ward-change-reasons";
import { MovementWorkspaceCockpit } from "../movements/movement-workspace-cockpit";
import { useRoleGate, useRouteRole } from "../ward-role-gate";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { ChipGroup, FilterChip, StateLine, StatusGlyph, buttonClass, RowUndo } from "@/components/wf";
import { undoWindowEnds } from "../ward-undo-until";
import { useUndoableStep } from "../use-undoable-step";
import { BED_PULL_UNDONE, bedPullUndoEvent } from "../ward-bed-pull-undo";
import { BED_PULL_UNDO_TOAST_MS } from "../ward-operational-defaults";
import { TransportExceptionDialog } from "@/components/ward-management/transport-exception-dialog";
import {
  arrivalGaps,
  collectionGaps,
  handoverReadyGaps,
  type TransportBookingAnswers,
} from "@/components/ward-management/ward-transport-checks";
import {
  BLANK_TRANSPORT_BOOKING,
  TransportBookingForm,
} from "@/components/ward-management/transport/transport-booking-form";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { ArrivalIdentityDialog } from "@/components/ward-management/arrival-identity-dialog";
import ph from "../referrals/referral-match-phone.module.css";
import styles from "./patient-transit-operations.module.css";
import { FindAWard, wardMatchesQuery } from "@/components/ward-management/referrals/find-a-ward";
import { ExtendHoldControl } from "@/components/ward-management/ward-extend-hold";
import { useDeskActingWard } from "@/components/ward-management/ward-desk-acting-ward";
import { calendarDateOf, formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { PULL_NO_LIMIT_RECORDED } from "@/components/ward-management/ward-bed-hold";
import { observationEditingToken } from "@/components/ward-management/ward-flow-observation-events";
import {
  INTERMITTENT_INTERVAL_MINUTES,
  NO_INTERVAL_ERROR,
  OBSERVATION_LEVELS,
  PULL_NEEDS_OBSERVATION_LEVEL,
  observationAt,
  observationIsRecorded,
  observationLevelName,
  type ObservationLevel,
} from "@/components/ward-management/ward-observation";

/** All operational facts and eligibility are calculated from the current provider state. */
/**
 * `showMetrics={false}` on the Patient page, where the gate board status card above already states
 * the destination, bed, legal authority and transport. The strip stays for any other host.
 */
export function PatientTransitOperations({
  movement,
  showMetrics = true,
  bare = false,
}: {
  movement: Movement;
  showMetrics?: boolean;
  /** Inside a sheet that already names it (the Patient Now mockups): no section heading. */
  bare?: boolean;
}) {
  const {
    units,
    admissions,
    referrals,
    patients,
    movements,
    dispatch,
    rejections,
    readAuditEvents,
    configuration,
    dayZero,
  } = useWardFlowSelect(
    "units",
    "admissions",
    "referrals",
    "patients",
    "movements",
    "dispatch",
    "rejections",
    "readAuditEvents",
    "configuration",
    "dayZero",
  );
  // Audit 1 (CS-09, Josh 20 Oct): the gap dialogs name the person and UMRN, never "this patient".
  const subjectPatient = resolveSubjectPatient(movement, { patients, referrals, movements });
  const identity = patientIdentityLine(subjectPatient);
  const patientName = subjectPatient.displayName;
  const now = useWardFlowClock();
  const legalPosition = currentLegalPosition(movement);
  const baseId = useId();
  // Feature 11: each action asks the route's role; cross-role pairs are listed in `ward-role-permissions.ts`.
  const gate = useRoleGate();
  // B2 (site review, 12 Oct 2026): every step is raised as the route's own role, so the history
  // names who acted rather than a borrowed ward, ED or officer.
  const routeRole = useRouteRole();
  // A ward acts for the ward the patient is accepted at; the other roles name no unit. M9: only when
  // that ward is one of the desk's own; otherwise the desk is not offered Release pull.
  const { acting: wardActing, bedElsewhere } = useDeskActingWard(routeRole, movement.acceptedUnitId);
  // For BOOK_TRANSPORT, a ward acts for the sending ward (referral origin or source admission unit).
  const wardSendingActing =
    routeRole === "ward"
      ? (() => {
          const originUnitId =
            (movement.referralId
              ? referrals.find((referral) => referral.id === movement.referralId)?.originUnitId
              : undefined) ??
            admissions.find((admission) => admission.id === movement.sourceAdmissionId)?.unitId ??
            (movement as { originUnitId?: string }).originUnitId;
          return originUnitId ? { actingUnitId: originUnitId } : {};
        })()
      : {};
  const { run: runStep } = useUndoableStep({ dispatch, rejections, now, routeRole });
  const holdGate = gate("PULL_PATIENT");
  const bookGate = gate("BOOK_TRANSPORT");
  const handoverGate = gate("HANDOVER_READY");
  // D-80: a team readies only a journey it sent, never one it was asked to take (the server agrees).
  const access = useEffectiveWardAccess();
  const handoverMine =
    routeRole !== "community" ||
    (journeySentByKind(referrals, movement, routeRole) &&
      journeySentByDesk({ referrals, admissions }, movement, access, wardPlaceLookup(units)));
  const acceptedGate = gate("TRANSPORT_ACCEPTED");
  const enRouteGate = gate("TRANSPORT_EN_ROUTE");
  const collectedGate = gate("PATIENT_COLLECTED");
  const arrivedGate = gate("PATIENT_ARRIVED");
  // PERF-03 (H-0341): the audit read copies the whole log, so it runs when the state changes, not
  // on every keystroke in this panel (`readAuditEvents` changes identity only with the state).
  const auditEvents = useMemo(() => {
    const auditRead = readAuditEvents({ role: "coordinator" });
    return auditRead.status === "allowed" ? auditRead.value : [];
  }, [readAuditEvents]);
  const [rejectionBaseline] = useState(rejections.length);
  const [genderReason, setGenderReason] = useState<GenderPlacementReason | "">("");
  const [wardChecked, setWardChecked] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [wardQuery, setWardQuery] = useState("");
  const [submitted, setSubmitted] = useState<{ rejections: number; audit: number }>();
  const [overrideReason, setOverrideReason] = useState<OverrideReason | "">("");
  const [overrideUnitId, setOverrideUnitId] = useState<string>("");
  const [overrideUnitIds, setOverrideUnitIds] = useState<string[]>([]);
  const [booking, setBooking] = useState(false);
  const [collectCheck, setCollectCheck] = useState(false);
  const [handoverCheck, setHandoverCheck] = useState(false);
  // One raise for Mark handover ready, with the fit to travel reason when one was asked (D-187 item 10).
  const readyHandover = (exception?: { gaps: TransportExceptionGap[]; reason: TransportExceptionReason }) => {
    noteAttempt();
    dispatch({
      type: "HANDOVER_READY",
      role: routeRole,
      now,
      movementId: movement.id,
      ...(exception ? { exception } : {}),
    });
  };
  const [arriveCheck, setArriveCheck] = useState(false);
  // A34: the one transport booking form's answers, kept until the save is accepted (audit 24-3 SV-5).
  const [bookingAnswers, setBookingAnswers] = useState<TransportBookingAnswers>(BLANK_TRANSPORT_BOOKING);
  const [bookingLegalReason, setBookingLegalReason] = useState<TransportExceptionReason | "">("");
  const bookingSave = useWardFormSave(movement.id);
  // H-0117 (audit SM2-03): Ask wards and the override reason keep their answers until the save is
  // confirmed, the same as the booking form above.
  const askSave = useWardFormSave(`${movement.id}:ask-wards`);
  const overrideSave = useWardFormSave(`${movement.id}:override`);
  // Walk-through WT-11: an arrival with nothing open still checks the name and UMRN first.
  const [arriveConfirm, setArriveConfirm] = useState(false);
  const [releaseReason, setReleaseReason] = useState<ReleasePullReason | "">("");
  const [cancelReason, setCancelReason] = useState<CancelTransportReason | "">("");
  const [backTo, setBackTo] = useState<MovementStage | "">("");
  const [backReason, setBackReason] = useState<StepBackReason | "">("");
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  // D-188, tightened to every pull (Josh, 13 Nov 2026): with no observation level recorded, Pull the
  // bed asks for one (nothing chosen), records it with RECORD_OBSERVATION_LEVEL, and pulls only once
  // that is accepted. A refused record pulls nothing. The same choices and interval rule as the
  // accepted referral placement form.
  const levelAsked = !observationIsRecorded(movement.observation);
  const [pullLevel, setPullLevel] = useState<ObservationLevel | "">("");
  const [pullInterval, setPullInterval] = useState<number | null>(null);
  const [pullLevelError, setPullLevelError] = useState<string | null>(null);
  const levelSave = useWardFormSave(`${movement.id}:pull-level`);
  const nextActionRef = useRef<HTMLHeadingElement>(null);
  const workflowCheckpoint = [
    movement.stage,
    movement.closure?.at,
    movement.transport?.cadNumber,
    movement.transport?.acceptedAt,
    movement.transport?.enRouteAt,
    movement.transport?.collectedAt,
    movement.transport?.cancelledAt,
  ].join("|");
  const previousCheckpoint = useRef(workflowCheckpoint);
  useEffect(() => {
    if (previousCheckpoint.current !== workflowCheckpoint) {
      previousCheckpoint.current = workflowCheckpoint;
      nextActionRef.current?.focus({ preventScroll: true });
    }
  }, [workflowCheckpoint]);
  const formRef = useRef<HTMLFormElement>(null);
  const bookTriggerRef = useRef<HTMLButtonElement>(null);
  const open = !movement.closure && movement.stage !== "arrived";
  const destination = units.find((u) => u.id === movement.acceptedUnitId);
  const heldBed = admissions.find((a) => a.id === movement.admissionId);
  // H7 and H8 (D-210 (Josh, 14 Nov 2026)): the shared Ready and the shared fit classifier, as on the
  // coordinator's shortlist, so a ward with no Ready bed never reads "Fits, bed ready" here, a closed
  // ward never fits, and a ward whose only failing check is an old bed count can still be asked.
  const ready = useSharedReadyLookup();
  const candidates = units
    .filter((u) => u.cohort === movement.cohort)
    .map((unit) => ({ unit, verdict: shortlistVerdict(unit, eligibility(movement, unit, now, ready), ready) }));
  const eligibleCount = candidates.filter((c) => c.verdict.eligible).length;
  // D-77 (Josh, 21 Oct 2026): one Ask wards list. Wards already asked come first, then the wards that
  // fit, then the rest to review, three at a time. D-91: the list is the one Find a ward list, A to Z,
  // and its search reads the ward and its hospital, here as there.
  const askedRows = candidates
    .filter((c) => movement.referredUnitIds.includes(c.unit.id) && wardMatchesQuery(wardQuery, c.unit))
    .sort((a, b) => a.unit.name.localeCompare(b.unit.name));
  const notAskedRows = candidates
    .filter((c) => !movement.referredUnitIds.includes(c.unit.id))
    .map(({ unit, verdict }) => {
      const kind = placementFit(verdict).kind;
      return {
        unit,
        fit: kind === "fits" || kind === "stale_count",
        ready: readyBedsFor(unit, ready),
        ...(kind === "stale_count" ? { stale: staleCountWords(unit, now) } : {}),
        reason: candidateReason(verdict),
      };
    });
  // F-108 (A14-14): asking wards and withdrawing the bed search are the coordinator's
  // (`EVENT_ROLE.REFER_TO_UNITS`). Both are raised as the coordinator below, so a desk that may never
  // ask (a ward desk) is not offered them at all: no Ask button and no Withdraw referral.
  const referAllowed = gate("REFER_TO_UNITS").allowed;
  const canRefer =
    referAllowed &&
    open &&
    ["placement_requested", "destination_review"].includes(movement.stage) &&
    !movement.acceptedUnitId;
  const job = movement.transport;
  const activeJob = job && job.cancelledAt === undefined;
  const noTransport = movement.transportNeed?.needed === false && !activeJob;
  // A9-12 (Audit 9, 13 Nov 2026): the cancel the release hint names, here on the patient page. The
  // coordinator and the ED may cancel any job the engine would (CANCEL_TRANSPORT); other desks ask.
  const canCancelTransport =
    activeJob &&
    job.collectedAt === undefined &&
    job.arrivedAt === undefined &&
    (routeRole === "coordinator" || routeRole === "ed");
  // Reasons a correction button is unavailable. The buttons stay focusable (aria-disabled, not native
  // disabled) and point at these reasons so keyboard and screen-reader users hear why.
  const releasePullBlocked = !releaseReason
    ? "Choose a release reason first"
    : job?.collectedAt !== undefined
      ? "The bed cannot be released after the patient has been collected"
      : activeJob
        ? "Cancel the transport job before releasing the bed"
        : null;
  const stepBackBlocked = !backTo || !backReason ? "Choose both an earlier stage and a reason first" : null;
  const withdrawBlocked = !confirmWithdraw
    ? "Tick confirmation before withdrawing referral"
    : movement.referredUnitIds.length === 0
      ? "No open ward referrals to withdraw"
      : null;
  const remaining = movement.pullExpiresAt === undefined ? undefined : movement.pullExpiresAt - now;
  // D-192 (shared design parts item 4): after the toast, the Bed row keeps a quiet "Undo pull · until
  // 14:47" for the rest of the Undo window. The same guarded undo as the toast: it releases only this
  // pull, as made in error, and the engine refuses it once the pull is released or replaced.
  const releasePullGate = gate("RELEASE_PULL");
  let pullIndex = -1;
  for (let index = movement.stageChanges.length - 1; index >= 0; index -= 1) {
    if (movement.stageChanges[index].to === "pulled") {
      pullIndex = index;
      break;
    }
  }
  const rowUndoPull =
    open && movement.stage === "pulled" && destination && pullIndex >= 0 && releasePullGate.allowed
      ? { stageIndex: pullIndex, unitId: destination.id, endsAt: undoWindowEnds(movement.stageChanges[pullIndex].at) }
      : undefined;
  const searchStage = ["placement_requested", "destination_review", "accepted_awaiting_bed"].includes(movement.stage);
  const selectedTargets = selected.filter(
    (id) => candidates.some((c) => c.unit.id === id && c.verdict.eligible) && !movement.referredUnitIds.includes(id),
  );
  // Finding 188 (Josh, 27 Oct 2026): the cap is a warning everywhere. More wards than the usual
  // limit, counting wards already asked, may still be asked, and the screen says so.
  const referralCap = configuration.parallelReferralCap;
  const askSlots = Math.max(0, referralCap - movement.referredUnitIds.length);
  const askedTotal = movement.referredUnitIds.length + selectedTargets.length;
  const overCap = selectedTargets.length > 0 && askedTotal > referralCap;
  const needsGenderPlacement =
    genderReviewNeeded(movement.gender, movement.sex) &&
    selectedTargets.some((id) => !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(id)));
  const errors = rejections
    .slice(submitted?.rejections ?? rejectionBaseline)
    .filter((e) => e.movementId === movement.id || e.movementId === undefined);
  const latestAudit = submitted
    ? auditEvents
        .slice(submitted.audit)
        .filter((e) => e.subject.kind === "movement" && e.subject.movementId === movement.id)
        .at(-1)
    : undefined;

  function noteAttempt() {
    setSubmitted({ rejections: rejections.length, audit: auditEvents.length });
  }

  const lastActionRejection = errors
    .slice()
    .reverse()
    .find(
      (e) =>
        e.attempted === "ACCEPT_IN_PRINCIPLE" ||
        // D-188: a pull refused for no observation level is answered by Pull the bed's own level ask.
        (e.attempted === "PULL_PATIENT" && e.reason !== PULL_NEEDS_OBSERVATION_LEVEL) ||
        e.attempted === "REFER_TO_UNITS",
    );
  function closeBooking() {
    setBooking(false);
    requestAnimationFrame(() => bookTriggerRef.current?.focus());
  }

  const overridePanel =
    lastActionRejection &&
    (lastActionRejection.attempted === "ACCEPT_IN_PRINCIPLE" ||
      lastActionRejection.attempted === "PULL_PATIENT" ||
      lastActionRejection.attempted === "REFER_TO_UNITS") ? (
      <section className={styles.card} aria-labelledby={`${baseId}-override-title`}>
        <div className={styles.cardHeader}>
          <div>
            <span className={styles.eyebrow}>CLINICAL OVERRIDE</span>
            <h3 id={`${baseId}-override-title`}>Record why this is going ahead anyway</h3>
          </div>
        </div>
        <div className={styles.cardBody}>
          <p className={styles.deckHint} role="status">
            {lastActionRejection.reason}
          </p>
          <label>
            Override reason
            <select value={overrideReason} onChange={(e) => setOverrideReason(e.target.value as OverrideReason | "")}>
              <option value="">Choose reason</option>
              {OVERRIDE_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.primary}
            disabled={!overrideReason || overrideSave.pending}
            title={!overrideReason ? "Choose an override reason first" : undefined}
            onClick={() => {
              if (!overrideReason || !lastActionRejection || overrideSave.pending) return;
              const reason = overrideReason;
              const attempted = lastActionRejection.attempted;
              if (attempted === "ACCEPT_IN_PRINCIPLE" && !gate("ACCEPT_IN_PRINCIPLE").allowed) return;
              const unitId = overrideUnitId || destination?.id;
              const unitIds = overrideUnitIds.length > 0 ? overrideUnitIds : selectedTargets;
              if (attempted === "REFER_TO_UNITS" ? unitIds.length === 0 : !unitId) return;
              // The card stays on the refusal it answers until this save is accepted.
              overrideSave.submit(
                () => {
                  if (attempted === "ACCEPT_IN_PRINCIPLE" && unitId) {
                    return dispatch({
                      type: "ACCEPT_IN_PRINCIPLE",
                      role: routeRole,
                      now,
                      movementId: movement.id,
                      unitId,
                      ...(routeRole === "ward" ? { actingUnitId: unitId } : {}),
                      overrideReason: reason,
                    });
                  }
                  if (attempted === "PULL_PATIENT" && unitId) {
                    return dispatch({
                      type: "PULL_PATIENT",
                      role: routeRole,
                      now,
                      movementId: movement.id,
                      unitId,
                      ...(routeRole === "ward" ? { actingUnitId: unitId } : {}),
                      overrideReason: reason,
                    });
                  }
                  return dispatch({
                    type: "REFER_TO_UNITS",
                    role: "coordinator",
                    now,
                    movementId: movement.id,
                    unitIds,
                    overrideReason: reason,
                    ...(needsGenderPlacement && genderReason && wardChecked
                      ? { genderPlacementReason: genderReason, genderPlacementChecked: true as const }
                      : {}),
                  });
                },
                () => {
                  setOverrideReason("");
                  noteAttempt();
                  // The wards are now asked: the Ask wards refusal and ticks it answered are done with.
                  if (attempted === "REFER_TO_UNITS") {
                    askSave.clearError();
                    setSelected([]);
                  }
                },
              );
            }}
          >
            Record reason and continue
          </button>
          {overrideSave.error ? (
            <p className={styles.deckHint} role="alert" data-testid="ward-transit-override-failure">
              {overrideSave.error}
            </p>
          ) : null}
        </div>
      </section>
    ) : null;

  const askButtonUnavailable =
    !canRefer ||
    selectedTargets.length === 0 ||
    (needsGenderPlacement && (!genderReason || !wardChecked)) ||
    askSave.pending;
  const candidatePanel = (
    <section className={styles.card} aria-labelledby={`${baseId}-candidate-title`}>
      <div className={styles.cardHeader}>
        <div>
          <span className={styles.eyebrow}>DESTINATION REVIEW</span>
          <h3 id={`${baseId}-candidate-title`}>Ask wards</h3>
        </div>
        <span className={styles.count}>{eligibleCount} fit</span>
      </div>
      {/* D-91: the one Find a ward list, shared with Referrals' Ask more wards. Asked wards keep
          their own Accept bed action; the cap stays a warning, never a limit on ticking (finding 188). */}
      <div className={styles.askList}>
        <FindAWard
          query={wardQuery}
          onQueryChange={setWardQuery}
          rows={notAskedRows}
          chosen={selectedTargets}
          onToggle={(unitId, on) => setSelected(on ? [...selected, unitId] : selected.filter((id) => id !== unitId))}
          disabled={!canRefer}
          asked={{
            count: askedRows.length,
            rows: askedRows.map(({ unit, verdict }) => {
              const accepted = destination?.id === unit.id;
              const acceptGate = gate("ACCEPT_IN_PRINCIPLE", unit.id);
              return (
                <div key={unit.id} role="listitem" className={styles.askedRow} data-testid={`ward-ask-ward-${unit.id}`}>
                  <div className={ph.cand} data-kind={verdict.eligible ? "yes" : "review"}>
                    <Check size={16} aria-hidden="true" />
                    <span className={ph.who}>
                      <span className={ph.nm}>{unit.name}</span>
                      <span className={ph.sub}>{candidateReason(verdict)}</span>
                    </span>
                    <span className={ph.lab}>
                      <StatusGlyph tone={accepted ? "success" : "neutral"} size={9} />
                      {accepted ? "Accepted" : "Asked"}
                    </span>
                  </div>
                  {open && movement.stage === "destination_review" && (
                    <>
                      <button
                        type="button"
                        className={styles.secondary}
                        aria-disabled={!verdict.eligible || !acceptGate.allowed ? "true" : undefined}
                        aria-describedby={acceptGate.buttonProps["aria-describedby"]}
                        onClick={(e) => {
                          if (!verdict.eligible || !acceptGate.allowed) {
                            ignoreUnavailableActivation(e);
                            return;
                          }
                          setOverrideUnitId(unit.id);
                          noteAttempt();
                          dispatch({
                            type: "ACCEPT_IN_PRINCIPLE",
                            role: routeRole,
                            now,
                            movementId: movement.id,
                            unitId: unit.id,
                            ...(routeRole === "ward" ? { actingUnitId: unit.id } : {}),
                          });
                        }}
                      >
                        Accept bed at {unit.name} <ArrowRight size={15} aria-hidden="true" />
                      </button>
                      {acceptGate.note}
                    </>
                  )}
                </div>
              );
            }),
          }}
          note={`Usually up to ${referralCap} wards at once${
            movement.referredUnitIds.length > 0 ? `, counting the ${movement.referredUnitIds.length} already asked` : ""
          }.`}
          testIdPrefix="ward-ask-ward"
        />
      </div>
      {canRefer && needsGenderPlacement && (
        <div className={styles.cardBody}>
          <p className={styles.deckHint}>Record the placement plan agreed with the selected wards.</p>
          <label>
            Ward placement reason
            <select value={genderReason} onChange={(e) => setGenderReason(e.target.value as GenderPlacementReason)}>
              <option value="">Choose reason</option>
              {GENDER_PLACEMENT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className={styles.pick}>
            <input type="checkbox" checked={wardChecked} onChange={(e) => setWardChecked(e.target.checked)} />
            Placement checked with the ward
          </label>
        </div>
      )}
      {referAllowed ? (
        <div className={styles.cardFooter}>
          <span data-testid="ward-ask-count">
            {selectedTargets.length} of {askSlots} chosen
          </span>
          {overCap ? (
            <span role="status" className={styles.deckHint} data-testid="ward-ask-over-cap">
              This asks more wards than the usual limit of {referralCap}. You can still ask.
            </span>
          ) : null}
          {selectedTargets.length === 0 ? (
            <span id={`${baseId}-refer-wards-disabled-guidance`} className="sr-only">
              Tick at least one ward that fits before asking.
            </span>
          ) : null}
          <button
            type="button"
            className={styles.primary}
            aria-disabled={askButtonUnavailable ? "true" : undefined}
            aria-describedby={selectedTargets.length === 0 ? `${baseId}-refer-wards-disabled-guidance` : undefined}
            onClick={
              askButtonUnavailable
                ? ignoreUnavailableActivation
                : () => {
                    setOverrideUnitIds(selectedTargets);
                    noteAttempt();
                    askSave.submit(
                      () =>
                        dispatch({
                          type: "REFER_TO_UNITS",
                          role: "coordinator",
                          now,
                          movementId: movement.id,
                          unitIds: selectedTargets,
                          ...(needsGenderPlacement && genderReason && wardChecked
                            ? { genderPlacementReason: genderReason, genderPlacementChecked: true as const }
                            : {}),
                        }),
                      () => setSelected([]),
                    );
                  }
            }
          >
            {selectedTargets.length === 0
              ? askSlots === 0
                ? "Pick a ward"
                : `Pick up to ${askSlots} ward${askSlots === 1 ? "" : "s"}`
              : `Ask ${selectedTargets.length} ward${selectedTargets.length === 1 ? "" : "s"}`}{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {askSave.error ? (
        <p className={styles.deckHint} role="alert" data-testid="ward-transit-ask-failure">
          {askSave.error}
        </p>
      ) : null}
    </section>
  );
  const dispatchPanel = (
    <div className={styles.rightColumn}>
      <section className={styles.card} aria-labelledby={`${baseId}-dispatch-title`}>
        <div className={styles.cardHeader}>
          <div>
            <span className={styles.eyebrow}>NEXT ACTION</span>
            <h3 id={`${baseId}-dispatch-title`} tabIndex={-1} ref={nextActionRef}>
              Placement &amp; dispatch deck
            </h3>
          </div>
          <Ambulance size={21} aria-hidden="true" />
        </div>
        <div className={styles.cardBody}>
          <div className={styles.destination}>
            <span>Receiving ward</span>
            <strong>{destination?.name ?? "No destination recorded"}</strong>
            <p>{movement.blocker || "No hold-up recorded"}</p>
          </div>
          {destination && (
            <details>
              <summary>Receiving ward safety checks</summary>
              <ul className={styles.gates}>
                {eligibility(movement, destination, now).gates.map((g) => (
                  <li key={g.gate} data-pass={g.pass} data-mark={gateMark(g)}>
                    <span aria-hidden="true">
                      {gateMark(g) === "info" ? (
                        <Info size={12} strokeWidth={1.75} aria-hidden="true" />
                      ) : (
                        <StatusGlyph tone={g.pass ? "success" : "closed"} />
                      )}
                    </span>
                    <span className="sr-only">
                      {gateMark(g) === "info" ? "For information: " : g.pass ? "Met: " : "Not met: "}
                    </span>
                    <p>{g.detail}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {/* B5 (site review, 12 Oct 2026): one name for the step, from the status card to this button
              to its toast, which offers Undo like every other move. Undo releases the pull as made in
              error, the engine's own audited reverse. Task 7 wording (Josh, 21 Oct 2026): "Pull the bed",
              because a hold is a bed kept while a patient is on leave. */}
          {open && movement.stage === "accepted_awaiting_bed" && destination && (
            <>
              {levelAsked ? (
                <>
                  <p className={styles.deckHint} data-testid="ward-transit-pull-level-hint">
                    No observation level is recorded. Choose one before the bed is pulled.
                  </p>
                  {/* Q36: kit chips, as the cancel reason below, rather than a browser drop-down. */}
                  <div data-testid="ward-transit-pull-level" data-value={pullLevel}>
                    <ChipGroup label="Observation level">
                      {OBSERVATION_LEVELS.map((level) => (
                        <FilterChip
                          key={level}
                          pressed={pullLevel === level}
                          unavailable={levelSave.pending}
                          onPressedChange={() => {
                            if (levelSave.pending) return;
                            setPullLevel(level);
                            setPullLevelError(null);
                          }}
                        >
                          {observationLevelName(level)}
                        </FilterChip>
                      ))}
                    </ChipGroup>
                  </div>
                  {pullLevel === "intermittent" ? (
                    <div data-testid="ward-transit-pull-interval" data-value={pullInterval ?? ""}>
                      <ChipGroup label="Check every">
                        {INTERMITTENT_INTERVAL_MINUTES.map((minutes) => (
                          <FilterChip
                            key={minutes}
                            pressed={pullInterval === minutes}
                            unavailable={levelSave.pending}
                            onPressedChange={() => {
                              if (levelSave.pending) return;
                              setPullInterval(minutes);
                              setPullLevelError(null);
                            }}
                          >
                            {`Every ${minutes} minutes`}
                          </FilterChip>
                        ))}
                      </ChipGroup>
                    </div>
                  ) : null}
                </>
              ) : null}
              <button
                type="button"
                className={buttonClass({ variant: "pri" })}
                data-placement-action
                {...holdGate.buttonProps}
                aria-disabled={levelSave.pending ? "true" : undefined}
                onClick={() => {
                  if (!holdGate.allowed || levelSave.pending) return;
                  // D-188: the pull itself, sent once any level asked for here has been recorded.
                  const pullBed = () => {
                    setOverrideUnitId(destination.id);
                    noteAttempt();
                    // Audit 24-7 (CT-06): the pull's own stage-change entry, so Undo releases only this
                    // pull and is refused once it has been released or replaced.
                    const expectedPull = { unitId: destination.id, stageIndex: movement.stageChanges.length };
                    runStep(
                      {
                        type: "PULL_PATIENT",
                        role: routeRole,
                        now,
                        movementId: movement.id,
                        unitId: destination.id,
                        ...(routeRole === "ward" ? { actingUnitId: destination.id } : {}),
                      },
                      {
                        success: "Bed pulled",
                        undo: (at) =>
                          bedPullUndoEvent(routeRole, at, {
                            movementId: movement.id,
                            ...expectedPull,
                            ...(routeRole === "ward" ? { actingUnitId: destination.id } : {}),
                          }),
                        undone: BED_PULL_UNDONE,
                        // A9-02: the Undo stays offered for the whole Undo window, or until dismissed.
                        undoToastMs: BED_PULL_UNDO_TOAST_MS,
                      },
                    );
                  };
                  if (!levelAsked) {
                    pullBed();
                    return;
                  }
                  if (pullLevel === "" || (pullLevel === "intermittent" && pullInterval === null)) {
                    setPullLevelError(pullLevel === "" ? "Choose an observation level" : NO_INTERVAL_ERROR);
                    return;
                  }
                  setPullLevelError(null);
                  const observation =
                    pullLevel === "intermittent"
                      ? { ...observationAt(pullLevel), intervalMinutes: pullInterval }
                      : observationAt(pullLevel);
                  levelSave.submit(
                    () =>
                      wardRaise(
                        dispatch,
                        routeRole,
                        now,
                      )("RECORD_OBSERVATION_LEVEL", {
                        target: {
                          kind: "movement",
                          movementId: movement.id,
                          ...(routeRole === "ward" ? { actingUnitId: destination.id } : {}),
                        },
                        observation,
                        expected: observationEditingToken(
                          "movement",
                          movement.id,
                          movement.observation,
                          movement.observationChanges?.length ?? 0,
                        ),
                      }),
                    pullBed,
                  );
                }}
              >
                <BedSingle size={16} aria-hidden="true" />
                Pull the bed
              </button>
              {holdGate.note}
              {levelSave.error || pullLevelError ? (
                <StateLine
                  kind="error"
                  compact
                  data-testid="ward-transit-pull-level-failure"
                  title={pullLevelError ?? `The bed is not pulled. ${levelSave.error}`}
                />
              ) : null}
            </>
          )}
          {/* F-106 (A14-04): once the person has arrived, or the journey is closed, the bed is no
              longer held for them, so the pull timer goes with it rather than lingering until Esc. */}
          {open && remaining === undefined && movement.stage === "pulled" && (
            // D-187 (F-46): a pull with no limit recorded says so, never a default.
            <p className={styles.hold} role="status" data-testid="ward-patient-transit-pull-timer">
              Bed pulled · {PULL_NO_LIMIT_RECORDED}
            </p>
          )}
          {open && remaining !== undefined && (
            <p className={styles.hold} role="status" data-testid="ward-patient-transit-pull-timer">
              {remaining <= 0
                ? "Pull time limit passed. The bed stays pulled until released or given a new limit."
                : `Bed pulled · ${splitDuration(remaining)} left · Pull time limit ${formatInstantWithDay(movement.pullExpiresAt!, now)}${movement.pullExtensions?.length ? " · extended" : ""}`}
            </p>
          )}
          {rowUndoPull ? (
            <RowUndo
              verb="pull"
              until={calendarDateOf(rowUndoPull.endsAt, dayZero)}
              now={calendarDateOf(now, dayZero).getTime()}
              onUndo={() =>
                runStep(
                  bedPullUndoEvent(routeRole, now, {
                    movementId: movement.id,
                    unitId: rowUndoPull.unitId,
                    stageIndex: rowUndoPull.stageIndex,
                    ...(routeRole === "ward" ? { actingUnitId: rowUndoPull.unitId } : {}),
                  }),
                  { success: BED_PULL_UNDONE, who: patientName },
                )
              }
            />
          ) : null}
          {open && movement.stage === "pulled" && (
            <ExtendHoldControl
              movement={movement}
              dispatch={dispatch}
              rejections={rejections}
              now={now}
              showHeldUntil={false}
            />
          )}
          {/* The booked provider, CAD number, quoted ETA and escort show once, in the Transport block
              below this workspace (device audit, 11 Oct 2026). */}
          {open && movement.stage === "pulled" && !job && !booking && (
            <button
              ref={bookTriggerRef}
              type="button"
              className={styles.primary}
              {...bookGate.buttonProps}
              onClick={() => {
                if (!bookGate.allowed) return;
                setBookingAnswers(BLANK_TRANSPORT_BOOKING);
                setBookingLegalReason("");
                bookingSave.forget();
                setBooking(true);
                requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("select")?.focus());
              }}
            >
              Record transport booking
            </button>
          )}
          {open && movement.stage === "pulled" && !job && !booking && bookGate.note}
          {booking && !job && (
            // CS3-01: a page <form> is held against the board from its first touch. The shared booking
            // form books only from its own button, so Enter in a field must never submit here.
            <form ref={formRef} className={styles.booking} noValidate onSubmit={(e) => e.preventDefault()}>
              <h4>Sending team · record phone booking</h4>
              <TransportBookingForm
                answers={bookingAnswers}
                onAnswers={setBookingAnswers}
                legalReason={bookingLegalReason}
                onLegalReason={setBookingLegalReason}
                record={movement}
                patientName={patientName}
                now={now}
                testIds={{ prefix: "ward-transit", suffix: movement.id }}
                blockedReason={bookGate.allowed ? undefined : (bookGate.reason ?? "You cannot book transport here.")}
                pending={bookingSave.pending}
                error={bookingSave.error}
                onSubmit={(answers) => {
                  if (!bookGate.allowed) return;
                  noteAttempt();
                  bookingSave.submit(
                    () =>
                      dispatch({
                        type: "BOOK_TRANSPORT",
                        role: routeRole,
                        ...wardSendingActing,
                        now,
                        movementId: movement.id,
                        ...answers,
                      }),
                    closeBooking,
                  );
                }}
                onCancel={closeBooking}
              />
            </form>
          )}
          {open && movement.stage === "pulled" && (activeJob || noTransport) && handoverMine && (
            <button
              type="button"
              className={styles.primary}
              {...handoverGate.buttonProps}
              onClick={() => {
                if (!handoverGate.allowed) return;
                closeBooking();
                // D-187 item 10: no medical clearance recorded asks for a reason first. Never a block.
                if (handoverReadyGaps(movement).length > 0) {
                  setHandoverCheck(true);
                  return;
                }
                readyHandover();
              }}
            >
              Mark handover ready · sending team
            </button>
          )}
          <TransportExceptionDialog
            open={handoverCheck}
            who={identity}
            action="Mark handover ready"
            gaps={handoverReadyGaps(movement)}
            onClose={() => setHandoverCheck(false)}
            onConfirm={(reason) => {
              setHandoverCheck(false);
              readyHandover({ gaps: handoverReadyGaps(movement), reason });
            }}
            onContinueWithoutReason={() => {
              // D-189 item 9(e): the press goes through without a reason, and none is recorded.
              setHandoverCheck(false);
              readyHandover();
            }}
            testId="ward-patient-handover-check"
          />
          {open && movement.stage === "pulled" && (activeJob || noTransport) && handoverMine && handoverGate.note}
          {open && movement.stage === "handover_ready" && activeJob && (
            <div className={styles.actionStack}>
              <p className={styles.deckHint}>Transport officer · record each confirmed milestone.</p>
              <button
                type="button"
                className={styles.secondary}
                aria-disabled={job.acceptedAt !== undefined || !acceptedGate.allowed ? "true" : undefined}
                aria-describedby={acceptedGate.buttonProps["aria-describedby"]}
                onClick={(e) => {
                  if (job.acceptedAt !== undefined || !acceptedGate.allowed) {
                    ignoreUnavailableActivation(e);
                    return;
                  }
                  noteAttempt();
                  dispatch({ type: "TRANSPORT_ACCEPTED", role: routeRole, now, movementId: movement.id });
                }}
              >
                Provider accepted job
              </button>
              <button
                type="button"
                className={styles.secondary}
                aria-disabled={
                  job.acceptedAt === undefined || job.enRouteAt !== undefined || !enRouteGate.allowed
                    ? "true"
                    : undefined
                }
                aria-describedby={enRouteGate.buttonProps["aria-describedby"]}
                onClick={(e) => {
                  if (job.acceptedAt === undefined || job.enRouteAt !== undefined || !enRouteGate.allowed) {
                    ignoreUnavailableActivation(e);
                    return;
                  }
                  noteAttempt();
                  dispatch({ type: "TRANSPORT_EN_ROUTE", role: routeRole, now, movementId: movement.id });
                }}
              >
                Vehicle en route
              </button>
              <button
                type="button"
                className={styles.primary}
                aria-disabled={job.enRouteAt === undefined || !collectedGate.allowed ? "true" : undefined}
                aria-describedby={collectedGate.buttonProps["aria-describedby"]}
                onClick={(e) => {
                  if (job.enRouteAt === undefined || !collectedGate.allowed) {
                    ignoreUnavailableActivation(e);
                    return;
                  }
                  // Audit S-2 / A4-11: no Form 4A or no fit to travel warns and records a reason.
                  if (collectionGaps(movement, units).length > 0) {
                    setCollectCheck(true);
                    return;
                  }
                  noteAttempt();
                  dispatch({ type: "PATIENT_COLLECTED", role: routeRole, now, movementId: movement.id });
                }}
              >
                Mark moving · patient collected
              </button>
              <TransportExceptionDialog
                open={collectCheck}
                who={identity}
                action="Mark moving"
                gaps={collectionGaps(movement, units)}
                onClose={() => setCollectCheck(false)}
                onConfirm={(reason) => {
                  setCollectCheck(false);
                  noteAttempt();
                  dispatch({
                    type: "PATIENT_COLLECTED",
                    role: routeRole,
                    now,
                    movementId: movement.id,
                    exception: { gaps: collectionGaps(movement, units), reason },
                  });
                }}
                testId="ward-patient-collect-check"
              />
              {acceptedGate.note}
              {enRouteGate.note}
              {collectedGate.note}
            </div>
          )}
          {open &&
            (movement.stage === "moving" || (noTransport && ["pulled", "handover_ready"].includes(movement.stage))) &&
            destination && (
              <>
                <button
                  type="button"
                  className={styles.primary}
                  {...arrivedGate.buttonProps}
                  onClick={() => {
                    if (!arrivedGate.allowed) return;
                    // Audit r1 item 4: no transport leg and fit to travel open warns, never blocks.
                    if (arrivalGaps(movement).length > 0) setArriveCheck(true);
                    else setArriveConfirm(true);
                  }}
                >
                  Confirm arrival · receiving ward
                </button>
                <ArrivalIdentityDialog
                  open={arriveConfirm}
                  who={subjectPatient.formalName}
                  identity={identity}
                  wardName={destination.name}
                  onClose={() => setArriveConfirm(false)}
                  onConfirm={() => {
                    setArriveConfirm(false);
                    noteAttempt();
                    dispatch({
                      type: "PATIENT_ARRIVED",
                      role: routeRole,
                      now,
                      movementId: movement.id,
                      ...(routeRole === "ward" ? { actingUnitId: destination.id } : {}),
                    });
                  }}
                  testId="ward-patient-arrival-identity"
                />
                <TransportExceptionDialog
                  open={arriveCheck}
                  who={identity}
                  action="Confirm arrival"
                  gaps={arrivalGaps(movement)}
                  onClose={() => setArriveCheck(false)}
                  onConfirm={(reason) => {
                    setArriveCheck(false);
                    noteAttempt();
                    dispatch({
                      type: "PATIENT_ARRIVED",
                      role: routeRole,
                      now,
                      movementId: movement.id,
                      ...(routeRole === "ward" ? { actingUnitId: destination.id } : {}),
                      exception: { gaps: arrivalGaps(movement), reason },
                    });
                  }}
                  testId="ward-patient-arrive-check"
                />
                {arrivedGate.note}
              </>
            )}
          {!destination && (
            <p className={styles.deckHint}>Select eligible wards and refer. Record acceptance before pulling a bed.</p>
          )}
        </div>
      </section>
      {open && (
        <section className={styles.card} aria-labelledby="correction-title">
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.eyebrow}>REVIEW & CORRECTIONS</span>
              <h3 id="correction-title">Review & corrections</h3>
            </div>
          </div>
          <div className={styles.cardBody}>
            {canCancelTransport && (
              <details data-testid="ward-patient-cancel-transport">
                <summary>Cancel transport</summary>
                <ChipGroup label="Reason for cancelling">
                  {CANCEL_TRANSPORT_REASONS.map((r) => (
                    <FilterChip key={r} pressed={cancelReason === r} onPressedChange={() => setCancelReason(r)}>
                      {changeReasonLabels[r]}
                    </FilterChip>
                  ))}
                </ChipGroup>
                <p className={styles.deckHint} id={`${baseId}-cancel-transport-who`}>
                  For {identity}. The bed stays pulled.
                </p>
                <button
                  type="button"
                  className={styles.secondary}
                  aria-disabled={cancelReason ? undefined : "true"}
                  aria-describedby={`${baseId}-cancel-transport-who`}
                  title={cancelReason ? undefined : "Choose a reason first"}
                  onClick={(e) => {
                    if (!cancelReason) {
                      ignoreUnavailableActivation(e);
                      return;
                    }
                    noteAttempt();
                    wardRaise(
                      dispatch,
                      routeRole,
                      now,
                    )("CANCEL_TRANSPORT", {
                      movementId: movement.id,
                      reason: cancelReason,
                    });
                    setCancelReason("");
                  }}
                >
                  Cancel transport
                </button>
              </details>
            )}
            {movement.stage === "pulled" && !bedElsewhere && (
              <details>
                <summary>Release bed pull</summary>
                <label>
                  Release reason
                  <select value={releaseReason} onChange={(e) => setReleaseReason(e.target.value as ReleasePullReason)}>
                    <option value="">Choose reason</option>
                    {RELEASE_PULL_REASONS.map((r) => (
                      <option value={r} key={r}>
                        {changeReasonLabels[r]}
                      </option>
                    ))}
                  </select>
                </label>
                {releasePullBlocked ? (
                  <span id={`${baseId}-release-pull-disabled-guidance`} className="sr-only">
                    {releasePullBlocked}
                  </span>
                ) : null}
                {/* Audit 24-7 (CT-19): the final button sits beside the name and UMRN of the patient
                    whose pulled bed is released. */}
                <p className={styles.deckHint} id={`${baseId}-release-pull-who`} data-testid="ward-release-pull-who">
                  For {identity}
                </p>
                <button
                  type="button"
                  className={styles.secondary}
                  aria-disabled={releasePullBlocked ? "true" : undefined}
                  aria-describedby={
                    releasePullBlocked
                      ? `${baseId}-release-pull-who ${baseId}-release-pull-disabled-guidance`
                      : `${baseId}-release-pull-who`
                  }
                  onClick={(e) => {
                    if (releasePullBlocked || !releaseReason) {
                      ignoreUnavailableActivation(e);
                      return;
                    }
                    noteAttempt();
                    dispatch({
                      type: "RELEASE_PULL",
                      role: routeRole,
                      ...wardActing,
                      now,
                      movementId: movement.id,
                      reason: releaseReason,
                    });
                  }}
                >
                  Release pull
                </button>
                {activeJob && (
                  <p className={styles.deckHint}>
                    {canCancelTransport
                      ? "Cancel transport above before releasing the bed."
                      : "The team that booked transport cancels it before the bed can be released."}
                  </p>
                )}
              </details>
            )}
            {MOVEMENT_STAGES.indexOf(movement.stage) > 0 && (
              <details>
                <summary>Step back with recorded reason</summary>
                <p className={styles.deckHint}>Corrects the stage record only. Pulled beds and bookings stay.</p>
                <label>
                  Earlier movement stage
                  <select value={backTo} onChange={(e) => setBackTo(e.target.value as MovementStage)}>
                    <option value="">Choose stage</option>
                    {MOVEMENT_STAGES.slice(0, MOVEMENT_STAGES.indexOf(movement.stage)).map((s) => (
                      <option value={s} key={s}>
                        {stageCopy[s].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Clinical / operational reason
                  <select value={backReason} onChange={(e) => setBackReason(e.target.value as StepBackReason)}>
                    <option value="">Choose reason</option>
                    {STEP_BACK_REASONS.map((r) => (
                      <option value={r} key={r}>
                        {stepBackReasonLabels[r]}
                      </option>
                    ))}
                  </select>
                </label>
                {stepBackBlocked ? (
                  <span id={`${baseId}-step-back-disabled-guidance`} className="sr-only">
                    {stepBackBlocked}
                  </span>
                ) : null}
                <button
                  type="button"
                  className={styles.secondary}
                  aria-disabled={stepBackBlocked ? "true" : undefined}
                  aria-describedby={stepBackBlocked ? `${baseId}-step-back-disabled-guidance` : undefined}
                  onClick={(e) => {
                    if (stepBackBlocked || !backTo || !backReason) {
                      ignoreUnavailableActivation(e);
                      return;
                    }
                    noteAttempt();
                    dispatch({
                      type: "STEP_BACK_STAGE",
                      role: "coordinator",
                      now,
                      movementId: movement.id,
                      to: backTo,
                      reason: backReason,
                    });
                  }}
                >
                  Record step-back
                </button>
              </details>
            )}
            {canRefer && (
              <details>
                <summary>Withdraw referral</summary>
                <p className={styles.deckHint}>Ends the bed search and withdraws every open ward referral.</p>
                <label className={styles.pick}>
                  <input
                    type="checkbox"
                    checked={confirmWithdraw}
                    onChange={(e) => setConfirmWithdraw(e.target.checked)}
                  />
                  {/* Audit 24-1 (B-05): the confirm line names the patient whose bed search ends. */}
                  Confirm this bed search is no longer required for {identity}
                </label>
                {withdrawBlocked ? (
                  <span id={`${baseId}-withdraw-referral-disabled-guidance`} className="sr-only">
                    {withdrawBlocked}
                  </span>
                ) : null}
                {/* Audit 24-7 (CT-19): the final button sits beside the patient's name and UMRN. */}
                <p
                  className={styles.deckHint}
                  id={`${baseId}-withdraw-referral-who`}
                  data-testid="ward-withdraw-referral-who"
                >
                  For {identity}
                </p>
                <button
                  type="button"
                  className={styles.secondary}
                  aria-disabled={withdrawBlocked ? "true" : undefined}
                  aria-describedby={
                    withdrawBlocked
                      ? `${baseId}-withdraw-referral-who ${baseId}-withdraw-referral-disabled-guidance`
                      : `${baseId}-withdraw-referral-who`
                  }
                  onClick={(e) => {
                    if (withdrawBlocked || !confirmWithdraw || movement.referredUnitIds.length === 0) {
                      ignoreUnavailableActivation(e);
                      return;
                    }
                    noteAttempt();
                    dispatch({
                      type: "WITHDRAW_REFERRAL",
                      role: "coordinator",
                      now,
                      movementId: movement.id,
                      actingPlaceId: "coordinator",
                    });
                  }}
                >
                  Withdraw referral
                </button>
              </details>
            )}
          </div>
        </section>
      )}
    </div>
  );
  return (
    <section className={styles.deck} aria-labelledby={`${baseId}-transit-title`}>
      <header className={styles.heading} hidden={bare}>
        <div>
          <span className={styles.eyebrow}>PATIENT NOW / BEDFLOW</span>
          <h2 id={`${baseId}-transit-title`}>Transit operations</h2>
        </div>
      </header>
      {/* Audit 24-1 (B-05): the sheet that hosts this deck covers the page header on a phone, so the
          deck names the patient and UMRN at its top. Ask wards and Withdraw referral act on them. */}
      {bare ? (
        <p className={styles.deckHint} data-testid="ward-transit-patient">
          <strong>{identity}</strong>
        </p>
      ) : null}
      <div aria-live="polite" aria-atomic="true" className={styles.feedback}>
        {errors.length > 0 ? (
          <p role="alert">{errors.map((e) => e.reason).join(" · ")}</p>
        ) : latestAudit ? (
          <p>{latestAudit.outcome === "accepted" ? "Recorded." : "Check the audit record."}</p>
        ) : null}
      </div>
      {showMetrics ? (
        <div className={styles.metrics}>
          <div>
            <Hospital size={18} aria-hidden="true" />
            <span>Destination</span>
            <strong>{destination?.name ?? "Awaiting acceptance"}</strong>
            <small>{movement.referredUnitIds.length} open ward referrals</small>
          </div>
          <div>
            <BedSingle size={18} aria-hidden="true" />
            <span>Bed reservation</span>
            <strong>{heldBed ? (heldBed.state === "occupied" ? "Occupied" : "Bed pulled") : "No bed pulled"}</strong>
            <small>
              {remaining === undefined
                ? "No pull expiry recorded"
                : remaining <= 0
                  ? "Pull expired · review required"
                  : `${splitDuration(remaining)} remaining`}
            </small>
          </div>
          <div>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Legal authority</span>
            <strong>{movement.legalForm ? legalFormName(movement.legalForm) : "Not recorded"}</strong>
            <small>
              {/* Audit H4 (14 Nov 2026): the one current legal position, and the typed time with its
                  day when it is on another day (D-93). */}
              {legalPosition.ended
                ? FORM_RECORDED_ENDED
                : legalPosition.dueAt === undefined
                  ? "No paper expiry recorded"
                  : `Paper expiry ${typedClock(legalPosition.dueAt, now, dayZero)}`}
            </small>
          </div>
          <div>
            <Ambulance size={18} aria-hidden="true" />
            <span>Transport</span>
            <strong>{activeJob ? job.provider : noTransport ? "Not required" : "Awaiting booking"}</strong>
            <small>
              {activeJob
                ? /^CAD/i.test(job.cadNumber ?? "")
                  ? job.cadNumber
                  : cadNumberToFollow(job)
                    ? // CAD to follow (Josh, 27 Oct 2026): a dispatched job booked before the number came.
                      CAD_TO_FOLLOW
                    : job.cadNumber
                      ? cadNumberLine(job.cadNumber)
                      : "CAD not recorded"
                : "Sending team records booking"}
            </small>
          </div>
        </div>
      ) : null}
      {!open && (
        <p className={styles.notice}>
          Movement complete. The recorded placement and transport remain visible; operational actions are closed.
        </p>
      )}
      {overridePanel}
      {/* Device audit (11 Oct 2026): once a bed is pulled (stage 4 on), the ward search is settled, so the
          shortlist and eligibility reference give way to the placement and dispatch work alone. */}
      {/* B5 (site review, 12 Oct 2026): once a ward has accepted, the dispatch deck names it and the
          refer-to-wards list gives way; inside a sheet the deck is one column. */}
      <div
        className={styles.columns}
        data-assigned={Boolean(destination)}
        data-single={bare || !searchStage || Boolean(destination)}
      >
        {destination || !searchStage ? dispatchPanel : candidatePanel}
        {searchStage && !destination ? dispatchPanel : null}
      </div>
      <details className={`${styles.card} ${styles.additional}`}>
        <summary>
          Additional workflow controls <span>Hold-ups, urgency, transport exceptions & paper authority</span>
        </summary>
        <MovementWorkspaceCockpit
          movementId={movement.id}
          embedded
          role={routeRole === "ward" ? "ward" : "coordinator"}
        />
      </details>
    </section>
  );
}
