"use client";

import { useState } from "react";

import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import {
  isOpen,
  movementTimeline,
  referralForMovement,
  stageCopy,
  transportLeg,
  unitCapacity,
} from "@/components/ward-management/ward-derivations";
import { OVERRIDE_REASONS, type OverrideReason } from "@/components/ward-management/ward-change-reasons";
import { candidateReason, eligibility } from "@/components/ward-management/ward-eligibility";
import { MOVEMENT_STAGES, genderReviewNeeded, type MovementStage } from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { edById } from "@/components/ward-management/ward-sites";

import { waitedMinutes } from "../movements-derivations";
import { meaningfulBlocker, tierTone } from "../movements-board";
import { JOB_STATE_LABEL, jobState } from "../movement-flow-figures";
import {
  NOT_WIRED,
  FLOW_ROUTES,
  Panel,
  Pill,
  FlowHeader,
  Segmented,
  Verdict,
  patientInitials,
  plainRefusal,
  plural,
  waited,
  type Attention,
} from "../movement-flow-parts";
import { useMovementFlow } from "../use-movement-flow";
import styles from "../movement-flow.module.css";

type Filter = "eligible" | "all" | "referred";
const TRANSPORT_STEPS = ["Requested", "Accepted", "En route", "Collected", "Arrived"] as const;
const TRANSPORT_STEP_LABEL: Record<(typeof TRANSPORT_STEPS)[number], string> = {
  Requested: "Requested",
  Accepted: "Accepted",
  "En route": "On the way",
  Collected: "Patient on board",
  Arrived: "Arrived",
};

/**
 * Proposed record for one movement. Leads with where this person is and what happens next, keeps
 * the journey, destination options and transport on one page, and puts history and facts below.
 */
export function MovementRecordProposal({ movementId }: { movementId: string }) {
  const { world, now, asAt } = useMovementFlow();
  const { dispatch, units, bedReleases, referrals, rejections } = world;
  const [filter, setFilter] = useState<Filter>("eligible");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [rejectionBaseline, setRejectionBaseline] = useState<number | null>(null);
  const [lastTargets, setLastTargets] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState<OverrideReason | "">("");
  const movement = world.movements.find((candidate) => candidate.id === movementId);

  if (!movement) {
    return (
      <main id="main-content" className={styles.page} data-testid="movement-record-proposal">
        <FlowHeader
          crumbs={[{ label: "Movements", href: FLOW_ROUTES.board }, { label: movementId }]}
          title="Movement not found"
          asAt={asAt}
        />
        <p className={styles.empty}>
          No movement is recorded with this number.{" "}
          <a className={styles.link} href={FLOW_ROUTES.board}>
            Back to movements
          </a>
        </p>
      </main>
    );
  }

  const initials = patientInitials(movement, world);
  const open = isOpen(movement);
  const ed = edById(movement.originEdId);
  const destination = units.find((unit) => unit.id === movement.acceptedUnitId);
  const candidates = units
    .filter((unit) => unit.cohort === movement.cohort)
    .map((unit) => ({
      unit,
      verdict: eligibility(movement, unit, now),
      beds: unitCapacity(unit, bedReleases).available,
    }));
  const eligibleCount = candidates.filter((candidate) => candidate.verdict.eligible).length;
  const referredCount = movement.referredUnitIds.length;
  const askedIds = new Set([...movement.referredUnitIds, ...movement.declines.map((decline) => decline.unitId)]);
  const respondedCount = units.filter((unit) => unit.cohort === movement.cohort && askedIds.has(unit.id)).length;
  const shown = candidates
    .filter((candidate) =>
      filter === "all" ? true : filter === "referred" ? askedIds.has(candidate.unit.id) : candidate.verdict.eligible,
    )
    .sort(
      (a, b) =>
        Number(b.verdict.eligible) - Number(a.verdict.eligible) ||
        b.beds - a.beds ||
        a.unit.name.localeCompare(b.unit.name),
    );
  const canRefer =
    open && ["placement_requested", "destination_review"].includes(movement.stage) && !movement.acceptedUnitId;
  const targets = selected.filter(
    (id) =>
      candidates.some((candidate) => candidate.unit.id === id && candidate.verdict.eligible) &&
      !movement.referredUnitIds.includes(id),
  );
  const genderCheckNeeded =
    genderReviewNeeded(movement.gender, movement.sex) &&
    targets.some((id) => !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(id)));
  const job = movement.transport;
  const leg = transportLeg(job);
  const state = jobState(movement);
  const blocker = meaningfulBlocker(movement);
  const referral = referralForMovement(movement, referrals);
  const stageAt: Partial<Record<MovementStage, number | undefined>> = {
    placement_requested: movement.openedAt,
    destination_review: movement.referredAt,
    accepted_awaiting_bed: movement.acceptedAt,
    moving: job?.collectedAt,
    arrived: job?.arrivedAt,
  };
  const arrived = !open && movement.closure?.outcome === "arrived";
  // A movement that did not proceed stops at the stage it reached; later stages stay untouched.
  const reachedIndex = MOVEMENT_STAGES.indexOf(movement.stage);
  const currentIndex = open ? reachedIndex : arrived ? MOVEMENT_STAGES.length : reachedIndex + 1;
  const refused =
    rejectionBaseline === null
      ? []
      : rejections.slice(rejectionBaseline).filter((rejection) => rejection.movementId === movement.id);
  const wait = waited(waitedMinutes(movement, now));

  const answer = !open
    ? arrived
      ? `Arrived. This movement is resolved.`
      : `This movement did not proceed. It stopped at ${stageCopy[movement.stage].label.toLowerCase()}.`
    : movement.stage === "placement_requested" || movement.stage === "destination_review"
      ? `Waiting ${wait} for a ward. ${plural(eligibleCount, "ward is", "wards are")} eligible now; ${referredCount} referred, ${movement.declines.length} declined.`
      : movement.stage === "accepted_awaiting_bed"
        ? `Accepted by ${destination?.name ?? "a ward not found"}; waiting for the bed to be pulled. Open ${wait}.`
        : movement.stage === "moving"
          ? `On the way to ${destination?.name ?? "a ward not found"}. ${state ? JOB_STATE_LABEL[state].label : "No transport job recorded"}.`
          : `Bed at ${destination?.name ?? "a ward not found"} is held. Transport: ${state ? JOB_STATE_LABEL[state].label.toLowerCase() : "not booked"}.`;

  const attention: Attention[] = [
    ...(open && blocker ? [{ label: blocker, tone: "warn" as const }] : []),
    ...(open && ["pulled", "handover_ready"].includes(movement.stage) && !job
      ? [{ label: "No transport booked", tone: "warn" as const }]
      : []),
    ...(open && movement.declines.length
      ? [{ label: `${movement.declines.length} declined`, tone: "info" as const }]
      : []),
  ];

  const refer = () => {
    setRejectionBaseline(rejections.length);
    dispatch({ type: "REFER_TO_UNITS", role: "coordinator", now, movementId: movement.id, unitIds: targets });
    setMessage(`Referral sent to ${plural(targets.length, "ward")} for ${initials}.`);
    setLastTargets(targets);
    setSelected([]);
  };

  /** The engine's own override path: a refused referral can go ahead only with a recorded reason. */
  const referAnyway = () => {
    if (!overrideReason || lastTargets.length === 0) return;
    setRejectionBaseline(rejections.length);
    dispatch({
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now,
      movementId: movement.id,
      unitIds: lastTargets,
      overrideReason,
    });
    setMessage(`Referral recorded with an override reason for ${initials}.`);
    setOverrideReason("");
  };

  return (
    <main id="main-content" className={styles.page} data-testid="movement-record-proposal">
      <FlowHeader
        crumbs={[{ label: "Movements", href: FLOW_ROUTES.board }, { label: movement.id }]}
        title={initials}
        badges={
          <>
            <Pill tone={tierTone(movement.urgency)}>{urgencyTierLabel(movement.urgency)}</Pill>
            <Pill>{open ? stageCopy[movement.stage].label : "Resolved"}</Pill>
          </>
        }
        asAt={asAt}
        actions={
          <>
            <button className={styles.textButton} type="button" onClick={() => setMessage(NOT_WIRED)}>
              Copy handover
            </button>
            <a className={styles.textButton} href={`/mockups/ward-flow/movements/${encodeURIComponent(movement.id)}`}>
              Full record
            </a>
          </>
        }
      />

      <Verdict attention={attention}>
        <strong>{answer}</strong>
      </Verdict>

      <p className={message && !refused.length ? styles.toast : styles.srOnly} role="status">
        {refused.length ? "" : message}
      </p>

      <Panel
        title="Journey"
        question="Where this movement is. Times show only where they are recorded."
        meta={`Opened ${formatInstantWithDay(movement.openedAt, now)}`}
      >
        <ol className={styles.stepper} aria-label="Journey stages">
          {MOVEMENT_STAGES.map((id, index) => {
            const at = stageAt[id];
            const status = index < currentIndex ? "done" : index === currentIndex && open ? "now" : "next";
            return (
              <li
                key={id}
                className={`${styles.journeyStep} ${status === "done" ? styles.stepDone : status === "now" ? styles.stepNow : ""}`}
                aria-current={status === "now" ? "step" : undefined}
              >
                <span className={styles.stepName}>{stageCopy[id].label}</span>
                <span className={styles.stepTime}>
                  {at !== undefined && index <= currentIndex
                    ? formatInstantWithDay(at, now)
                    : status === "now"
                      ? `Open ${wait}`
                      : !open && !arrived && index === reachedIndex
                        ? "Did not proceed"
                        : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className={styles.grid2}>
        <Panel
          title="Destination options"
          question="Wards for this person's cohort, eligible first. Beds are the capacity screen's beds ready now."
          meta={open ? `${eligibleCount} eligible of ${candidates.length}` : "Resolved"}
          flush
          foot={
            <>
              <span>
                {!canRefer
                  ? !open
                    ? "This movement is resolved."
                    : destination
                      ? `Accepted by ${destination.name}.`
                      : "Referral is closed at this stage."
                  : genderCheckNeeded
                    ? "A gender placement check is needed for a selected ward. Refer from the full record."
                    : `${targets.length} selected`}
              </span>
              {open ? (
                <button
                  className={styles.buttonPrimary}
                  type="button"
                  disabled={!canRefer || targets.length === 0 || genderCheckNeeded}
                  onClick={refer}
                >
                  Refer to selected wards
                </button>
              ) : null}
            </>
          }
        >
          {open ? (
            <div className={styles.toolbar}>
              <Segmented<Filter>
                label="Show wards"
                value={filter}
                onChange={setFilter}
                options={[
                  { id: "eligible", label: "Eligible", count: eligibleCount },
                  { id: "referred", label: "Referred or declined", count: respondedCount },
                  { id: "all", label: "All", count: candidates.length },
                ]}
              />
            </div>
          ) : null}
          {!open ? (
            <div className={styles.panelBody}>
              <p className={styles.empty}>Ward options are shown only while a ward is still being found.</p>
            </div>
          ) : shown.length === 0 ? (
            <div className={styles.panelBody}>
              <p className={styles.empty}>
                {filter === "referred"
                  ? "No ward has been referred or has declined yet."
                  : "No ward is eligible now. Choose All to see why."}
              </p>
            </div>
          ) : (
            <div className={styles.tableScroll} role="region" aria-label="Destination options table" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.checkboxCell}>
                      <span className={styles.srOnly}>Select</span>
                    </th>
                    <th scope="col">Ward</th>
                    <th scope="col">Status</th>
                    <th scope="col" className={styles.num}>
                      Beds ready
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(({ unit, verdict, beds }) => {
                    const referred = movement.referredUnitIds.includes(unit.id);
                    const accepted = movement.acceptedUnitId === unit.id;
                    const declined = movement.declines.some((decline) => decline.unitId === unit.id);
                    const selectable = canRefer && verdict.eligible && !referred;
                    return (
                      <tr key={unit.id}>
                        <td className={styles.checkboxCell}>
                          <label>
                            <span className={styles.srOnly}>Select {unit.name}</span>
                            <input
                              className={styles.checkbox}
                              type="checkbox"
                              disabled={!selectable}
                              checked={selected.includes(unit.id)}
                              onChange={(event) =>
                                setSelected(
                                  event.target.checked
                                    ? [...selected, unit.id]
                                    : selected.filter((id) => id !== unit.id),
                                )
                              }
                            />
                          </label>
                        </td>
                        <td>
                          <span className={styles.rowName}>
                            <span>{unit.name}</span>
                            <span className={styles.rowSub}>
                              {unit.siteCode} · {unit.authorised ? "Authorised" : "Not authorised"}
                            </span>
                          </span>
                        </td>
                        <td>
                          {accepted ? (
                            <Pill tone="good">Accepted</Pill>
                          ) : declined ? (
                            <Pill>Declined</Pill>
                          ) : referred ? (
                            <Pill>Referred</Pill>
                          ) : verdict.eligible ? (
                            <Pill>Eligible</Pill>
                          ) : (
                            <span className={styles.barrier}>{candidateReason(verdict)}</span>
                          )}
                        </td>
                        <td className={styles.num}>{beds}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {refused.length ? (
            <div className={styles.panelBody}>
              <p className={styles.refused} role="alert">
                Not recorded. {plainRefusal(refused.at(-1)?.reason)}
              </p>
              {refused.at(-1)?.attempted === "REFER_TO_UNITS" && lastTargets.length ? (
                <p className={styles.note}>
                  <label className={styles.srOnly} htmlFor="movement-proposal-override">
                    Override reason
                  </label>
                  <select
                    id="movement-proposal-override"
                    className={styles.select}
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value as OverrideReason | "")}
                  >
                    <option value="">Choose why this goes ahead anyway</option>
                    {OVERRIDE_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>{" "}
                  <button className={styles.textButton} type="button" disabled={!overrideReason} onClick={referAnyway}>
                    Refer anyway
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}
        </Panel>

        <div className={styles.stack}>
          <Panel
            title="Transport"
            question={job ? "This movement's transport job." : "No transport job is recorded."}
            meta={
              leg === undefined ? "None" : leg === "Cancelled" || leg === "Arrived" ? leg : JOB_STATE_LABEL[leg].label
            }
            foot={
              job && leg !== "Arrived" ? <a href={FLOW_ROUTES.transport}>Work this job in Transport Hub</a> : undefined
            }
          >
            {job ? (
              <>
                <ol className={`${styles.jobSteps} ${styles.jobSteps5}`} aria-label="Transport steps">
                  {TRANSPORT_STEPS.map((step, index) => {
                    const at = TRANSPORT_STEPS.indexOf((leg === "Cancelled" ? "Requested" : leg) ?? "Requested");
                    return (
                      <li
                        key={step}
                        className={`${styles.jobStep} ${index < at ? styles.jobStepDone : index === at ? styles.jobStepNow : ""}`}
                        aria-current={index === at ? "step" : undefined}
                      >
                        {TRANSPORT_STEP_LABEL[step]}
                      </li>
                    );
                  })}
                </ol>
                <dl className={styles.facts}>
                  <div className={styles.fact}>
                    <dt>Provider</dt>
                    <dd>{job.provider}</dd>
                  </div>
                  <div className={styles.fact}>
                    <dt>Escort</dt>
                    <dd>{job.escortRequired ? "Required" : "Not required"}</dd>
                  </div>
                  <div className={styles.fact}>
                    <dt>Dispatch (CAD) number</dt>
                    <dd>{job.cadNumber ?? "Not recorded"}</dd>
                  </div>
                  <div className={styles.fact}>
                    <dt>Estimated time</dt>
                    <dd>
                      {job.estimatedAt !== undefined
                        ? transportEtaRemainingLabel(job.estimatedAt, now)
                        : "Not recorded"}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <p className={styles.empty}>
                  {!open
                    ? "No transport was booked before this movement was resolved."
                    : ["pulled", "handover_ready"].includes(movement.stage)
                      ? "The bed is held and no transport is booked."
                      : "Transport is booked once a bed is pulled."}
                </p>
                {open ? (
                  <p className={styles.note}>
                    <button className={styles.textButton} type="button" onClick={() => setMessage(NOT_WIRED)}>
                      Log a booking
                    </button>
                  </p>
                ) : null}
              </>
            )}
          </Panel>

          <Panel title="Checks" question="What is recorded for this move.">
            <ul className={styles.checks}>
              {[
                {
                  ok: destination !== undefined,
                  label: destination ? `Destination: ${destination.name}` : "No destination yet",
                },
                {
                  ok: movement.medicalClearance?.cleared === true,
                  label: movement.medicalClearance
                    ? movement.medicalClearance.cleared
                      ? "Medically cleared"
                      : "Not medically cleared"
                    : "Medical clearance not recorded",
                },
                {
                  ok: null,
                  label: `Legal status as recorded: ${movement.legalStatus}`,
                },
                {
                  ok: null,
                  label: `Needs ${movement.security.toLowerCase()} ward · ${movement.cohort}${movement.specialling ? " · specialling" : ""}${movement.highAcuity ? " · high acuity" : ""}`,
                },
              ].map((check) => (
                <li key={check.label} className={styles.check}>
                  <span
                    className={`${styles.checkMark} ${check.ok === false ? styles.checkOpen : styles.checkOk}`}
                    aria-hidden="true"
                  >
                    {check.ok === null ? "·" : check.ok ? "✓" : "!"}
                  </span>
                  <span>
                    <span className={styles.srOnly}>
                      {check.ok === null ? "As recorded: " : check.ok ? "Recorded: " : "Open: "}
                    </span>
                    {check.label}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <div className={styles.grid2Even}>
        <Panel
          title="History"
          question="Recorded events, newest first."
          meta={plural(movementTimeline(movement).length, "event")}
        >
          <ol className={styles.timeline}>
            {[...movementTimeline(movement)]
              .sort((a, b) => b.at - a.at)
              .map((event) => (
                <li key={`${event.at}-${event.label}`} className={styles.timelineRow}>
                  <span className={styles.timelineAt}>{formatInstantWithDay(event.at, now)}</span>
                  <span>{event.label}</span>
                </li>
              ))}
          </ol>
        </Panel>

        <Panel title="Details" question="Who owns this movement and where it came from.">
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>From</dt>
              <dd>{ed?.name ?? "Department not found"}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Owner</dt>
              <dd>{movement.owner}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Referral</dt>
              <dd>{referral ? "Linked" : "No referral linked"}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Documents</dt>
              <dd>{movement.uploadedForms?.length ?? 0} uploaded</dd>
            </div>
          </dl>
          <p className={styles.note}>
            <button className={styles.textButton} type="button" onClick={() => setMessage(NOT_WIRED)}>
              Open documents
            </button>
          </p>
        </Panel>
      </div>
    </main>
  );
}
