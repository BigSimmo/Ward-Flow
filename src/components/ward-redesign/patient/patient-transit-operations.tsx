"use client";

// Mock-up fork of `ward-management/patients/patient-transit-operations.tsx`. The one change (D-91):
// the Ask wards card's list is the one Find a ward list (`referrals/find-a-ward.tsx`), the same
// search, groups and rows as Referrals' Ask more wards. Asking, accepting a bed and the cap warning
// are wired exactly as before. Build note: the real build makes the same swap and deletes this fork.

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { journeySentByKind } from "@/components/ward-management/ward-journey-sender";
import { journeySentByDesk } from "@/components/ward-management/ward-referral-sender";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, BedDouble, Check, Hospital, ShieldCheck, Truck } from "lucide-react";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { candidateReason, eligibility, gateMark } from "@/components/ward-management/ward-eligibility";
import { stageCopy } from "@/components/ward-management/ward-derivations";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { CAD_TO_FOLLOW, cadNumberToFollow } from "@/components/ward-management/ward-cad-number";
import {
  MOVEMENT_STAGES,
  genderReviewNeeded,
  STEP_BACK_REASONS,
  stepBackReasonLabels,
  type Movement,
  type MovementStage,
  type StepBackReason,
  type TransportExceptionReason,
} from "@/components/ward-management/ward-model";
import {
  GENDER_PLACEMENT_REASONS,
  type GenderPlacementReason,
  OVERRIDE_REASONS,
  type OverrideReason,
  RELEASE_PULL_REASONS,
  type ReleasePullReason,
  changeReasonLabels,
} from "@/components/ward-management/ward-change-reasons";
import { MovementWorkspaceCockpit } from "@/components/ward-management/movements/movement-workspace-cockpit";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { StatusGlyph } from "@/components/wf";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { TransportExceptionDialog } from "@/components/ward-management/transport-exception-dialog";
import {
  arrivalGaps,
  collectionGaps,
  type TransportBookingAnswers,
} from "@/components/ward-management/ward-transport-checks";
import {
  BLANK_TRANSPORT_BOOKING,
  TransportBookingForm,
} from "@/components/ward-management/transport/transport-booking-form";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { ArrivalIdentityDialog } from "@/components/ward-management/arrival-identity-dialog";
import { clock, dur } from "@/components/ward-management/patients/patient-now-records";
import ph from "@/components/ward-management/referrals/referral-match-phone.module.css";
import styles from "@/components/ward-management/patients/patient-transit-operations.module.css";
import { FindAWard, wardMatchesQuery } from "@/components/ward-management/referrals/find-a-ward";

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
  const { units, admissions, referrals, patients, movements, dispatch, rejections, readAuditEvents, configuration } =
    useWardFlowSelect(
      "units",
      "admissions",
      "referrals",
      "patients",
      "movements",
      "dispatch",
      "rejections",
      "readAuditEvents",
      "configuration",
    );
  // Audit 1 (CS-09, Josh 20 Oct): the gap dialogs name the person and UMRN, never "this patient".
  const subjectPatient = resolveSubjectPatient(movement, { patients, referrals, movements });
  const identity = patientIdentityLine(subjectPatient);
  const patientName = subjectPatient.displayName;
  const now = useWardFlowClock();
  const baseId = useId();
  // Feature 11: each action asks the route's role; cross-role pairs are listed in `ward-role-permissions.ts`.
  const gate = useRoleGate();
  // B2 (site review, 12 Oct 2026): every step is raised as the route's own role, so the history
  // names who acted rather than a borrowed ward, ED or officer.
  const routeRole = useRouteRole();
  // A ward acts for the ward the patient is accepted at; the other roles name no unit.
  const wardActing = routeRole === "ward" ? { actingUnitId: movement.acceptedUnitId } : {};
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
  const [backTo, setBackTo] = useState<MovementStage | "">("");
  const [backReason, setBackReason] = useState<StepBackReason | "">("");
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
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
  const candidates = units
    .filter((u) => u.cohort === movement.cohort)
    .map((unit) => ({ unit, verdict: eligibility(movement, unit, now) }));
  const eligibleCount = candidates.filter((c) => c.verdict.eligible).length;
  // D-77 (Josh, 21 Oct 2026): one Ask wards list. Wards already asked come first, then the wards that
  // fit, then the rest to review, three at a time. D-91: the list is the one Find a ward list, A to Z,
  // and its search reads the ward and its hospital, here as there.
  const askedRows = candidates
    .filter((c) => movement.referredUnitIds.includes(c.unit.id) && wardMatchesQuery(wardQuery, c.unit))
    .sort((a, b) => a.unit.name.localeCompare(b.unit.name));
  const notAskedRows = candidates
    .filter((c) => !movement.referredUnitIds.includes(c.unit.id))
    .map(({ unit, verdict }) => ({ unit, fit: verdict.eligible, reason: candidateReason(verdict) }));
  const canRefer =
    open && ["placement_requested", "destination_review"].includes(movement.stage) && !movement.acceptedUnitId;
  const job = movement.transport;
  const activeJob = job && job.cancelledAt === undefined;
  const noTransport = movement.transportNeed?.needed === false && !activeJob;
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
        e.attempted === "ACCEPT_IN_PRINCIPLE" || e.attempted === "PULL_PATIENT" || e.attempted === "REFER_TO_UNITS",
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
          <Truck size={21} aria-hidden="true" />
        </div>
        <div className={styles.cardBody}>
          <div className={styles.destination}>
            <span>Receiving ward</span>
            <strong>{destination?.name ?? "No destination recorded"}</strong>
            <p>{movement.blocker || "No blocker recorded"}</p>
          </div>
          {destination && (
            <details>
              <summary>Receiving ward safety checks</summary>
              <ul className={styles.gates}>
                {eligibility(movement, destination, now).gates.map((g) => (
                  <li key={g.gate} data-pass={g.pass} data-mark={gateMark(g)}>
                    <span>{gateMark(g) === "info" ? "i" : g.pass ? "✓" : "!"}</span>
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
              <button
                type="button"
                className={styles.primary}
                {...holdGate.buttonProps}
                onClick={() => {
                  if (!holdGate.allowed) return;
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
                    },
                    {
                      success: "Bed pulled",
                      undo: (at) => ({
                        type: "RELEASE_PULL",
                        role: routeRole,
                        now: at,
                        movementId: movement.id,
                        reason: "pull_made_in_error",
                        ...(routeRole === "ward" ? { actingUnitId: destination.id } : {}),
                        expectedPull,
                      }),
                      undone: "Bed pull undone.",
                    },
                  );
                }}
              >
                <BedDouble size={16} aria-hidden="true" />
                Pull the bed
              </button>
              {holdGate.note}
            </>
          )}
          {remaining !== undefined && (
            <p className={styles.hold} role="status">
              {remaining <= 0
                ? "Pull time limit passed. The bed stays pulled until a person releases it or sets a new limit."
                : `Bed pulled · ${dur(remaining)} remaining · Pull time limit ${clock(movement.pullExpiresAt!)}`}
            </p>
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
                noteAttempt();
                dispatch({ type: "HANDOVER_READY", role: routeRole, now, movementId: movement.id });
              }}
            >
              Mark handover ready · sending team
            </button>
          )}
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
                  if (collectionGaps(movement).length > 0) {
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
                gaps={collectionGaps(movement)}
                onClose={() => setCollectCheck(false)}
                onConfirm={(reason) => {
                  setCollectCheck(false);
                  noteAttempt();
                  dispatch({
                    type: "PATIENT_COLLECTED",
                    role: routeRole,
                    now,
                    movementId: movement.id,
                    exception: { gaps: collectionGaps(movement), reason },
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
                  who={subjectPatient.displayName}
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
            {movement.stage === "pulled" && (
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
                    Cancel the transport job in additional controls before releasing the bed.
                  </p>
                )}
              </details>
            )}
            {MOVEMENT_STAGES.indexOf(movement.stage) > 0 && (
              <details>
                <summary>Step back with recorded reason</summary>
                <p className={styles.deckHint}>
                  Corrects the stage record. Pulled beds and transport bookings remain until explicitly released or
                  cancelled.
                </p>
                <label>
                  Earlier journey stage
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
          <p>Coordinate the next step with the patient’s clinical context in view.</p>
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
          <p>
            {latestAudit.outcome === "accepted"
              ? "Recorded in the shared patient journey."
              : "Review the action outcome in the audit record."}
          </p>
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
            <BedDouble size={18} aria-hidden="true" />
            <span>Bed reservation</span>
            <strong>{heldBed ? (heldBed.state === "occupied" ? "Occupied" : "Bed pulled") : "No bed pulled"}</strong>
            <small>
              {remaining === undefined
                ? "No pull expiry recorded"
                : remaining <= 0
                  ? "Pull expired · review required"
                  : `${dur(remaining)} remaining`}
            </small>
          </div>
          <div>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Legal authority</span>
            <strong>{movement.legalForm ? legalFormName(movement.legalForm) : "Not recorded"}</strong>
            <small>
              {movement.legalForm?.dueAt === undefined
                ? "No paper expiry recorded"
                : `Paper expiry ${clock(movement.legalForm.dueAt)}`}
            </small>
          </div>
          <div>
            <Truck size={18} aria-hidden="true" />
            <span>Transport</span>
            <strong>{activeJob ? job.provider : noTransport ? "Not required" : "Awaiting booking"}</strong>
            <small>
              {activeJob
                ? /^CAD/i.test(job.cadNumber ?? "")
                  ? job.cadNumber
                  : cadNumberToFollow(job)
                    ? // CAD to follow (Josh, 27 Oct 2026): a dispatched job booked before the number came.
                      CAD_TO_FOLLOW
                    : `CAD ${job.cadNumber ?? "not recorded"}`
                : "Sending team records booking"}
            </small>
          </div>
        </div>
      ) : null}
      {!open && (
        <p className={styles.notice}>
          Journey complete. The recorded placement and transport remain visible; operational actions are closed.
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
          Additional workflow controls <span>Blockers, urgency, transport exceptions & paper authority</span>
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
