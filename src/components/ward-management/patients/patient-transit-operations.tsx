"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BedDouble, Check, Search, Hospital, ShieldCheck, Truck } from "lucide-react";
import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import { candidateReason, eligibility } from "../ward-eligibility";
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
  RELEASE_PULL_REASONS,
  type ReleasePullReason,
} from "../ward-change-reasons";
import { MovementWorkspaceCockpit } from "../movements/movement-workspace-cockpit";
import { clock, dur } from "./patient-now-records";
import styles from "./patient-transit-operations.module.css";

/** All operational facts and eligibility are calculated from the current provider state. */
export function PatientTransitOperations({ movement }: { movement: Movement }) {
  const { units, admissions, dispatch, rejections, readAuditEvents } = useWardFlow();
  const now = useWardFlowClock();
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
  const [provider, setProvider] = useState<TransportProvider | "">("");
  const [cad, setCad] = useState("");
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
  const remaining = movement.pullExpiresAt === undefined ? undefined : movement.pullExpiresAt - now;
  const selectedTargets = selected.filter(
    (id) => candidates.some((c) => c.unit.id === id && c.verdict.eligible) && !movement.referredUnitIds.includes(id),
  );
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
      <section className={styles.card} aria-labelledby="override-title">
        <div className={styles.cardHeader}>
          <div>
            <span className={styles.eyebrow}>CLINICAL OVERRIDE</span>
            <h3 id="override-title">Record why this is going ahead anyway</h3>
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
            onClick={() => {
              if (!overrideReason || !lastActionRejection) return;
              const reason = overrideReason;
              noteAttempt();
              if (lastActionRejection.attempted === "ACCEPT_IN_PRINCIPLE") {
                const unitId = overrideUnitId || destination?.id;
                if (!unitId) return;
                dispatch({
                  type: "ACCEPT_IN_PRINCIPLE",
                  role: "ward",
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
                  role: "coordinator",
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
    <section className={styles.card} aria-labelledby="candidate-title">
      <div className={styles.cardHeader}>
        <div>
          <span className={styles.eyebrow}>DESTINATION REVIEW</span>
          <h3 id="candidate-title">{destination ? "Network eligibility reference" : "Network ward shortlist"}</h3>
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
                    {verdict.gates.filter((g) => g.pass).length}/{verdict.gates.length} checks
                  </span>
                </summary>
                <ul className={styles.gates}>
                  {verdict.gates.map((g) => (
                    <li key={g.gate} data-pass={g.pass}>
                      <span aria-hidden="true">{g.pass ? "✓" : "!"}</span>
                      <div>
                        <strong>{g.gate.replace(/_/g, " ")}</strong>
                        <p>{g.detail}</p>
                      </div>
                      <span>{g.pass ? "Pass" : "Review"}</span>
                    </li>
                  ))}
                </ul>
              </details>
              {referred && open && movement.stage === "destination_review" && (
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={!verdict.eligible}
                  onClick={() => {
                    setOverrideUnitId(unit.id);
                    noteAttempt();
                    dispatch({
                      type: "ACCEPT_IN_PRINCIPLE",
                      role: "ward",
                      now,
                      movementId: movement.id,
                      unitId: unit.id,
                    });
                  }}
                >
                  Accept bed <ArrowRight size={15} aria-hidden="true" />
                </button>
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
      <div className={styles.cardFooter}>
        <span>{selectedTargets.length} wards selected</span>
        <button
          type="button"
          className={styles.primary}
          disabled={
            !canRefer || selectedTargets.length === 0 || (needsGenderPlacement && (!genderReason || !wardChecked))
          }
          onClick={() => {
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
            });
            setSelected([]);
          }}
        >
          Refer to selected wards <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
  const dispatchPanel = (
    <div className={styles.rightColumn}>
      <section className={styles.card} aria-labelledby="dispatch-title">
        <div className={styles.cardHeader}>
          <div>
            <span className={styles.eyebrow}>NEXT ACTION</span>
            <h3 id="dispatch-title" tabIndex={-1} ref={nextActionRef}>
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
                  <li key={g.gate} data-pass={g.pass}>
                    <span>{g.pass ? "✓" : "!"}</span>
                    <p>{g.detail}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {open && movement.stage === "accepted_awaiting_bed" && destination && (
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setOverrideUnitId(destination.id);
                noteAttempt();
                dispatch({
                  type: "PULL_PATIENT",
                  role: "coordinator",
                  now,
                  movementId: movement.id,
                  unitId: destination.id,
                });
              }}
            >
              Pull patient into bed
            </button>
          )}
          {remaining !== undefined && (
            <p className={styles.hold} role="status">
              {remaining <= 0
                ? "Hold expired. Review the reservation before progressing."
                : `Bed hold · ${dur(remaining)} remaining · expires ${clock(movement.pullExpiresAt!)}`}
            </p>
          )}
          {activeJob && (
            <dl className={styles.facts}>
              <div>
                <dt>Provider</dt>
                <dd>{job.provider}</dd>
              </div>
              <div>
                <dt>CAD number</dt>
                <dd>{job.cadNumber ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Quoted ETA</dt>
                <dd>{job.estimatedAt === undefined ? "Not recorded" : clock(job.estimatedAt)}</dd>
              </div>
              <div>
                <dt>Clinical escort</dt>
                <dd>{job.escortRequired ? "Required" : "Not required"}</dd>
              </div>
            </dl>
          )}
          {open && movement.stage === "pulled" && !job && !booking && (
            <button
              ref={bookTriggerRef}
              type="button"
              className={styles.primary}
              onClick={() => {
                setBooking(true);
                requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("select")?.focus());
              }}
            >
              Record transport booking
            </button>
          )}
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
                  !cad.trim() ||
                  !eta ||
                  !Number.isFinite(Number(eta)) ||
                  Number(eta) < 0
                )
                  return;
                noteAttempt();
                dispatch({
                  type: "BOOK_TRANSPORT",
                  role: "ed",
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
                <input required value={cad} onChange={(e) => setCad(e.target.value)} />
              </label>
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
              onClick={() => {
                closeBooking();
                noteAttempt();
                dispatch({ type: "HANDOVER_READY", role: "ed", now, movementId: movement.id });
              }}
            >
              Mark handover ready · sending team
            </button>
          )}
          {open && movement.stage === "handover_ready" && activeJob && (
            <div className={styles.actionStack}>
              <p className={styles.deckHint}>Transport officer · record each confirmed milestone.</p>
              <button
                type="button"
                className={styles.secondary}
                disabled={job.acceptedAt !== undefined}
                onClick={() => {
                  noteAttempt();
                  dispatch({ type: "TRANSPORT_ACCEPTED", role: "officer", now, movementId: movement.id });
                }}
              >
                Provider accepted job
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={job.acceptedAt === undefined || job.enRouteAt !== undefined}
                onClick={() => {
                  noteAttempt();
                  dispatch({ type: "TRANSPORT_EN_ROUTE", role: "officer", now, movementId: movement.id });
                }}
              >
                Vehicle en route
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={job.enRouteAt === undefined}
                onClick={() => {
                  noteAttempt();
                  dispatch({ type: "PATIENT_COLLECTED", role: "officer", now, movementId: movement.id });
                }}
              >
                Mark moving · patient collected
              </button>
            </div>
          )}
          {open &&
            (movement.stage === "moving" || (noTransport && ["pulled", "handover_ready"].includes(movement.stage))) &&
            destination && (
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  noteAttempt();
                  dispatch({
                    type: "PATIENT_ARRIVED",
                    role: "ward",
                    now,
                    movementId: movement.id,
                    actingUnitId: destination.id,
                  });
                }}
              >
                Confirm arrival · receiving ward
              </button>
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
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={!releaseReason || !!activeJob || job?.collectedAt !== undefined}
                  onClick={() => {
                    if (!releaseReason) return;
                    noteAttempt();
                    dispatch({
                      type: "RELEASE_PULL",
                      role: "coordinator",
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
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={!backTo || !backReason}
                  onClick={() => {
                    if (!backTo || !backReason) return;
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
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={!confirmWithdraw || movement.referredUnitIds.length === 0}
                  onClick={() => {
                    noteAttempt();
                    dispatch({ type: "WITHDRAW_REFERRAL", role: "coordinator", now, movementId: movement.id });
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
    <section className={styles.deck} aria-labelledby="transit-title">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>PATIENT NOW / BEDFLOW</span>
          <h2 id="transit-title">Transit operations</h2>
          <p>Coordinate the next step with the patient’s clinical context in view.</p>
        </div>
        <span className={styles.stage}>{stageCopy[movement.stage].label}</span>
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
          <small>{activeJob ? `CAD ${job.cadNumber ?? "not recorded"}` : "Sending team records booking"}</small>
        </div>
      </div>
      {!open && (
        <p className={styles.notice}>
          Journey complete. The recorded placement and transport remain visible; operational actions are closed.
        </p>
      )}
      {overridePanel}
      <div className={styles.columns} data-assigned={Boolean(destination)}>
        {destination ? dispatchPanel : candidatePanel}
        {destination ? candidatePanel : dispatchPanel}
      </div>
      <details className={`${styles.card} ${styles.additional}`}>
        <summary>
          Additional workflow controls <span>Blockers, urgency, transport exceptions & paper authority</span>
        </summary>
        <MovementWorkspaceCockpit movementId={movement.id} embedded role="ward" />
      </details>
    </section>
  );
}
