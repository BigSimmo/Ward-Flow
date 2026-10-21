"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, BedDouble, Check, Search, Hospital, ShieldCheck, Truck } from "lucide-react";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { candidateReason, checkedGates, eligibility, gateMark } from "../ward-eligibility";
import { stageCopy } from "../ward-derivations";
import { legalFormName } from "../ward-legal-forms";
import {
  MOVEMENT_STAGES,
  genderReviewNeeded,
  STEP_BACK_REASONS,
  stepBackReasonLabels,
  TRANSPORT_PROVIDERS,
  type Movement,
  type MovementStage,
  type StepBackReason,
  type TransportLegalStatus,
  type TransportProvider,
} from "../ward-model";
import {
  GENDER_PLACEMENT_REASONS,
  type GenderPlacementReason,
  OVERRIDE_REASONS,
  type OverrideReason,
  REFERRAL_CAP_REASONS,
  type ReferralCapReason,
  RELEASE_PULL_REASONS,
  type ReleasePullReason,
} from "../ward-change-reasons";
import { MovementWorkspaceCockpit } from "../movements/movement-workspace-cockpit";
import { useRoleGate, useRouteRole } from "../ward-role-gate";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { useUndoableStep } from "../use-undoable-step";
import { TransportExceptionDialog } from "@/components/ward-management/transport-exception-dialog";
import { arrivalGaps, collectionGaps } from "@/components/ward-management/ward-transport-checks";
import { cadNumberProblem } from "@/components/ward-management/ward-cad-number";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { clock, dur } from "./patient-now-records";
import styles from "./patient-transit-operations.module.css";

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
  const identity = patientIdentityLine(resolveSubjectPatient(movement, { patients, referrals, movements }));
  // Top 25 item 2: asking more wards than the cap warns and asks for a reason instead of refusing.
  const [capReason, setCapReason] = useState<ReferralCapReason | "">("");
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
  const acceptedGate = gate("TRANSPORT_ACCEPTED");
  const enRouteGate = gate("TRANSPORT_EN_ROUTE");
  const collectedGate = gate("PATIENT_COLLECTED");
  const arrivedGate = gate("PATIENT_ARRIVED");
  const auditRead = readAuditEvents({ role: "coordinator" });
  const auditEvents = auditRead.status === "allowed" ? auditRead.value : [];
  const [rejectionBaseline] = useState(rejections.length);
  const [genderReason, setGenderReason] = useState<GenderPlacementReason | "">("");
  const [wardChecked, setWardChecked] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [wardQuery, setWardQuery] = useState("");
  const [filter, setFilter] = useState<"eligible" | "all" | "referred">("eligible");
  const [submitted, setSubmitted] = useState<{ rejections: number; audit: number }>();
  const [overrideReason, setOverrideReason] = useState<OverrideReason | "">("");
  const [overrideUnitId, setOverrideUnitId] = useState<string>("");
  const [overrideUnitIds, setOverrideUnitIds] = useState<string[]>([]);
  const [booking, setBooking] = useState(false);
  const [collectCheck, setCollectCheck] = useState(false);
  const [arriveCheck, setArriveCheck] = useState(false);
  const [provider, setProvider] = useState<TransportProvider | "">("");
  const [cad, setCad] = useState("");
  // Blank is the form's own "required" prompt; a typed placeholder gets the reason (HAZ-03, #430).
  const cadHint = cad.trim() ? cadNumberProblem(cad) : undefined;
  const [eta, setEta] = useState("");
  const [legal, setLegal] = useState<TransportLegalStatus | "">("");
  const [escort, setEscort] = useState<"" | "yes" | "no">("");
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
  const shown = candidates.filter(
    (c) =>
      (filter === "all" ||
        (filter === "referred" ? movement.referredUnitIds.includes(c.unit.id) : c.verdict.eligible)) &&
      c.unit.name.toLowerCase().includes(wardQuery.toLowerCase().trim()),
  );
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
  const wardsAskedAfterSend = movement.referredUnitIds.length + selectedTargets.length;
  const overReferralCap = wardsAskedAfterSend > configuration.parallelReferralCap;
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
            disabled={!overrideReason}
            title={!overrideReason ? "Choose an override reason first" : undefined}
            onClick={() => {
              if (!overrideReason || !lastActionRejection) return;
              const reason = overrideReason;
              noteAttempt();
              if (lastActionRejection.attempted === "ACCEPT_IN_PRINCIPLE") {
                if (!gate("ACCEPT_IN_PRINCIPLE").allowed) return;
                const unitId = overrideUnitId || destination?.id;
                if (!unitId) return;
                dispatch({
                  type: "ACCEPT_IN_PRINCIPLE",
                  role: routeRole,
                  now,
                  movementId: movement.id,
                  unitId,
                  overrideReason: reason,
                });
              } else if (lastActionRejection.attempted === "PULL_PATIENT") {
                const unitId = overrideUnitId || destination?.id;
                if (!unitId) return;
                dispatch({
                  type: "PULL_PATIENT",
                  role: routeRole,
                  now,
                  movementId: movement.id,
                  unitId,
                  overrideReason: reason,
                });
              } else if (lastActionRejection.attempted === "REFER_TO_UNITS") {
                const unitIds = overrideUnitIds.length > 0 ? overrideUnitIds : selectedTargets;
                if (unitIds.length === 0) return;
                dispatch({
                  type: "REFER_TO_UNITS",
                  role: "coordinator",
                  now,
                  movementId: movement.id,
                  unitIds,
                  overrideReason: reason,
                });
              }
              setOverrideReason("");
            }}
          >
            Record reason and continue
          </button>
        </div>
      </section>
    ) : null;

  const candidatePanel = (
    <section className={styles.card} aria-labelledby={`${baseId}-candidate-title`}>
      <div className={styles.cardHeader}>
        <div>
          <span className={styles.eyebrow}>DESTINATION REVIEW</span>
          <h3 id={`${baseId}-candidate-title`}>
            {destination ? "Network eligibility reference" : "Network ward shortlist"}
          </h3>
        </div>
        <span className={styles.count}>{eligibleCount} eligible</span>
      </div>
      <label className={styles.wardSearch}>
        <Search size={15} aria-hidden="true" />
        <input
          aria-label="Search network wards"
          placeholder="Find a ward…"
          value={wardQuery}
          onChange={(event) => setWardQuery(event.target.value)}
        />
      </label>
      <div className={styles.filters} role="group" aria-label="Ward shortlist filter">
        {(
          [
            ["eligible", "Eligible"],
            ["all", "All wards"],
            ["referred", "Referred"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>
      <p className={styles.deckHint}>
        Current {movement.cohort.toLowerCase()} cohort · eligibility recalculates with capacity and legal status.
      </p>
      <div className={styles.candidates}>
        {shown.length === 0 && (
          <p className={styles.empty}>No wards match this view. Choose All wards to review the eligibility gates.</p>
        )}
        {shown.map(({ unit, verdict }) => {
          const referred = movement.referredUnitIds.includes(unit.id);
          const accepted = destination?.id === unit.id;
          return (
            <article className={styles.candidate} key={unit.id}>
              <div className={styles.candidateTop}>
                <label className={styles.pick}>
                  <input
                    type="checkbox"
                    checked={selectedTargets.includes(unit.id)}
                    disabled={!canRefer || !verdict.eligible || referred || accepted}
                    onChange={(e) =>
                      setSelected(e.target.checked ? [...selected, unit.id] : selected.filter((id) => id !== unit.id))
                    }
                  />
                  <strong>{unit.name}</strong>
                </label>
                <span className={styles.verdict} data-pass={verdict.eligible}>
                  {accepted ? "Accepted" : referred ? "Referred" : verdict.eligible ? "Eligible" : "Review gates"}
                </span>
              </div>
              <p>{candidateReason(verdict)}</p>
              <div className={styles.candidateMeta}>
                <span>{unit.allocatable.value} allocatable beds</span>
                <span>{unit.authorised ? "Authorised" : "Voluntary ward"}</span>
                <span>{unit.lockedBeds > 0 ? "Ward includes locked beds" : "Open ward"}</span>
              </div>
              <details>
                <summary>
                  Eligibility breakdown{" "}
                  <span>
                    {checkedGates(verdict.gates).filter((g) => g.pass).length}/{checkedGates(verdict.gates).length}{" "}
                    checks
                  </span>
                </summary>
                <ul className={styles.gates}>
                  {verdict.gates.map((g) => (
                    <li key={g.gate} data-pass={g.pass} data-mark={gateMark(g)}>
                      <span aria-hidden="true">{gateMark(g) === "info" ? "i" : g.pass ? "✓" : "!"}</span>
                      <div>
                        <strong>{g.gate.replace(/_/g, " ")}</strong>
                        <p>{g.detail}</p>
                      </div>
                      <span>{gateMark(g) === "info" ? "For information" : g.pass ? "Pass" : "Review"}</span>
                    </li>
                  ))}
                </ul>
              </details>
              {referred && open && movement.stage === "destination_review" && (
                <>
                  <button
                    type="button"
                    className={styles.secondary}
                    aria-disabled={
                      !verdict.eligible || !gate("ACCEPT_IN_PRINCIPLE", unit.id).allowed ? "true" : undefined
                    }
                    aria-describedby={gate("ACCEPT_IN_PRINCIPLE", unit.id).buttonProps["aria-describedby"]}
                    onClick={(e) => {
                      if (!verdict.eligible || !gate("ACCEPT_IN_PRINCIPLE", unit.id).allowed) {
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
                    Accept bed <ArrowRight size={15} aria-hidden="true" />
                  </button>
                  {gate("ACCEPT_IN_PRINCIPLE", unit.id).note}
                </>
              )}
            </article>
          );
        })}
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
      {canRefer && overReferralCap && (
        <div className={styles.cardBody} data-testid="referral-cap-warning">
          <p className={styles.deckHint} role="status">
            This asks {wardsAskedAfterSend} wards at once, more than the usual {configuration.parallelReferralCap}.
            Choose a reason to go ahead.
          </p>
          <label>
            Reason for asking more wards
            <select value={capReason} onChange={(e) => setCapReason(e.target.value as ReferralCapReason | "")}>
              <option value="">Choose reason</option>
              {REFERRAL_CAP_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className={styles.cardFooter}>
        <span>{selectedTargets.length} wards selected</span>
        {selectedTargets.length === 0 ? (
          <span id={`${baseId}-refer-wards-disabled-guidance`} className="sr-only">
            Select at least one ward above before sending a referral.
          </span>
        ) : null}
        <button
          type="button"
          className={styles.primary}
          aria-disabled={
            !canRefer ||
            selectedTargets.length === 0 ||
            (needsGenderPlacement && (!genderReason || !wardChecked)) ||
            (overReferralCap && !capReason)
              ? "true"
              : undefined
          }
          aria-describedby={selectedTargets.length === 0 ? `${baseId}-refer-wards-disabled-guidance` : undefined}
          onClick={
            !canRefer ||
            selectedTargets.length === 0 ||
            (needsGenderPlacement && (!genderReason || !wardChecked)) ||
            (overReferralCap && !capReason)
              ? ignoreUnavailableActivation
              : () => {
                  setOverrideUnitIds(selectedTargets);
                  noteAttempt();
                  dispatch({
                    type: "REFER_TO_UNITS",
                    role: "coordinator",
                    now,
                    movementId: movement.id,
                    unitIds: selectedTargets,
                    ...(needsGenderPlacement && genderReason && wardChecked
                      ? { genderPlacementReason: genderReason, genderPlacementChecked: true as const }
                      : {}),
                    ...(overReferralCap && capReason ? { overCapReason: capReason } : {}),
                  });
                  setSelected([]);
                  setCapReason("");
                }
          }
        >
          Refer to selected wards <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
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
          {/* B5 (site review, 12 Oct 2026): one name for the step, "Hold the bed", from the status
              card to this button to its toast, which offers Undo like every other move. Undo
              releases the hold as made in error, the engine's own audited reverse. */}
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
                  runStep(
                    {
                      type: "PULL_PATIENT",
                      role: routeRole,
                      now,
                      movementId: movement.id,
                      unitId: destination.id,
                    },
                    {
                      success: "Bed held",
                      undo: (at) => ({
                        type: "RELEASE_PULL",
                        role: routeRole,
                        now: at,
                        movementId: movement.id,
                        reason: "pull_made_in_error",
                        ...(routeRole === "ward" ? { actingUnitId: destination.id } : {}),
                      }),
                      undone: "Bed hold undone.",
                    },
                  );
                }}
              >
                <BedDouble size={16} aria-hidden="true" />
                Hold the bed
              </button>
              {holdGate.note}
            </>
          )}
          {remaining !== undefined && (
            <p className={styles.hold} role="status">
              {remaining <= 0
                ? "Bed hold expired. Review the hold before progressing."
                : `Bed held · ${dur(remaining)} remaining · expires ${clock(movement.pullExpiresAt!)}`}
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
                setBooking(true);
                requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("select")?.focus());
              }}
            >
              Record transport booking
            </button>
          )}
          {open && movement.stage === "pulled" && !job && !booking && bookGate.note}
          {booking && !job && (
            <form
              ref={formRef}
              className={styles.booking}
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  !provider ||
                  !legal ||
                  !escort ||
                  cadNumberProblem(cad) !== undefined ||
                  !eta ||
                  !Number.isFinite(Number(eta)) ||
                  Number(eta) < 0
                )
                  return;
                if (!bookGate.allowed) return;
                noteAttempt();
                dispatch({
                  type: "BOOK_TRANSPORT",
                  role: routeRole,
                  ...wardSendingActing,
                  now,
                  movementId: movement.id,
                  provider,
                  cadNumber: cad.trim(),
                  estimatedAt: now + Number(eta),
                  transportLegalStatus: legal,
                  escortRequired: escort === "yes",
                });
              }}
            >
              <h4>Sending team · record phone booking</h4>
              <label>
                Transport provider
                <select required value={provider} onChange={(e) => setProvider(e.target.value as TransportProvider)}>
                  <option value="">Choose provider</option>
                  {TRANSPORT_PROVIDERS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                CAD number
                <input
                  required
                  value={cad}
                  aria-invalid={cadHint !== undefined ? "true" : undefined}
                  aria-describedby={cadHint !== undefined ? `${baseId}-cad-hint` : undefined}
                  onChange={(e) => {
                    setCad(e.target.value);
                    // A refused number fails the browser's own required check, so Save stops at this
                    // field with the reason, the same way a blank required field does.
                    const problem = e.target.value.trim() ? cadNumberProblem(e.target.value) : undefined;
                    e.target.setCustomValidity(problem === undefined ? "" : `To save, ${problem}.`);
                  }}
                />
              </label>
              {/* Outside the label, so the hint describes the field without renaming it. */}
              {cadHint !== undefined && (
                <span id={`${baseId}-cad-hint`} className={styles.deckHint} role="status">
                  {`To save, ${cadHint}.`}
                </span>
              )}
              <label>
                Quoted ETA (minutes from now)
                <input required type="number" min="0" value={eta} onChange={(e) => setEta(e.target.value)} />
              </label>
              <label>
                Transport legal status
                <select required value={legal} onChange={(e) => setLegal(e.target.value as TransportLegalStatus)}>
                  <option value="">Choose status</option>
                  <option value="voluntary">Voluntary</option>
                  <option value="involuntary">Involuntary</option>
                </select>
              </label>
              <label>
                Clinical escort required?
                <select required value={escort} onChange={(e) => setEscort(e.target.value as typeof escort)}>
                  <option value="">Choose answer</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <div className={styles.actionRow}>
                <button type="button" className={styles.secondary} onClick={closeBooking}>
                  Close booking form
                </button>
                <button type="submit" className={styles.primary} disabled={!!activeJob}>
                  <Check size={16} aria-hidden="true" />
                  Save booking
                </button>
              </div>
            </form>
          )}
          {open && movement.stage === "pulled" && (activeJob || noTransport) && (
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
          {open && movement.stage === "pulled" && (activeJob || noTransport) && handoverGate.note}
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
                    if (arrivalGaps(movement).length > 0) {
                      setArriveCheck(true);
                      return;
                    }
                    noteAttempt();
                    dispatch({
                      type: "PATIENT_ARRIVED",
                      role: routeRole,
                      now,
                      movementId: movement.id,
                      ...(routeRole === "ward" ? { actingUnitId: destination.id } : {}),
                    });
                  }}
                >
                  Confirm arrival · receiving ward
                </button>
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
                        {r.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
                {releasePullBlocked ? (
                  <span id={`${baseId}-release-pull-disabled-guidance`} className="sr-only">
                    {releasePullBlocked}
                  </span>
                ) : null}
                <button
                  type="button"
                  className={styles.secondary}
                  aria-disabled={releasePullBlocked ? "true" : undefined}
                  aria-describedby={releasePullBlocked ? `${baseId}-release-pull-disabled-guidance` : undefined}
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
                  Corrects the stage record. Held beds and transport bookings remain until explicitly released or
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
                  Confirm this bed search is no longer required
                </label>
                {withdrawBlocked ? (
                  <span id={`${baseId}-withdraw-referral-disabled-guidance`} className="sr-only">
                    {withdrawBlocked}
                  </span>
                ) : null}
                <button
                  type="button"
                  className={styles.secondary}
                  aria-disabled={withdrawBlocked ? "true" : undefined}
                  aria-describedby={withdrawBlocked ? `${baseId}-withdraw-referral-disabled-guidance` : undefined}
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
            <strong>{heldBed ? (heldBed.state === "occupied" ? "Occupied" : "Bed held") : "No bed held"}</strong>
            <small>
              {remaining === undefined
                ? "No hold expiry recorded"
                : remaining <= 0
                  ? "Hold expired · review required"
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
