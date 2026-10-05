"use client";

import { useMemo, useState } from "react";

import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { changeReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { TRANSPORT_PROVIDERS, type Movement } from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";

import {
  acceptedBlockedReason,
  arrivedBlockedReason,
  collectedBlockedReason,
  enRouteBlockedReason,
} from "@/components/ward-management/officer/officer-screen";
import { edShort, tierTone } from "@/components/ward-management/movements/movements-board";
import {
  JOB_STATES,
  JOB_STATE_LABEL,
  jobState,
  type JobState,
} from "@/components/ward-management/movements/movement-flow-figures";
import {
  Definitions,
  KpiStrip,
  NOT_WIRED,
  FLOW_ROUTES,
  Panel,
  Pill,
  FlowHeader,
  Verdict,
  patientInitials,
  plainRefusal,
  plural,
  waited,
  type Attention,
} from "@/components/ward-management/movements/movement-flow-parts";
import { useMovementFlow } from "@/components/ward-management/movements/use-movement-flow";
import styles from "@/components/ward-management/movements/movement-flow.module.css";

type Filter = JobState | "escort" | "noCad" | "all";

/** The officer's four buttons, in order. "Delivered" is the officer's word for the arrival event. */
const STEPS: {
  from: JobState;
  label: string;
  event: "TRANSPORT_ACCEPTED" | "TRANSPORT_EN_ROUTE" | "PATIENT_COLLECTED" | "PATIENT_ARRIVED";
}[] = [
  { from: "Requested", label: "Accept job", event: "TRANSPORT_ACCEPTED" },
  { from: "Accepted", label: "Mark en route", event: "TRANSPORT_EN_ROUTE" },
  { from: "En route", label: "Mark collected", event: "PATIENT_COLLECTED" },
  { from: "Collected", label: "Mark delivered", event: "PATIENT_ARRIVED" },
];

const REFUSAL_LABEL: Record<string, string> = {
  TRANSPORT_ACCEPTED: "Accept",
  TRANSPORT_EN_ROUTE: "En route",
  PATIENT_COLLECTED: "Collected",
  PATIENT_ARRIVED: "Delivered",
};

function stateTone(state: JobState | undefined) {
  return state === "Requested" ? "warn" : "quiet";
}

/** Time since the step that put the job in its current state, so "waiting" always has a start. */
function sinceStep(movement: Movement): number | undefined {
  const job = movement.transport;
  // No job records when it was requested, so a waiting request has no start to count from.
  return job?.collectedAt ?? job?.enRouteAt ?? job?.acceptedAt;
}

/**
 * Proposed Transport Hub. One answer line, one strip of the four job states (the same rule the
 * movements screen uses), a compact job list and a single job sheet that offers only the next step.
 */
export function TransportHub() {
  const { world, now, transport, asAt, scopeLabel, scoped } = useMovementFlow();
  const { dispatch, units, rejections } = world;
  const [filter, setFilter] = useState<Filter>("all");
  const [provider, setProvider] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  // Holds the job being confirmed, so a confirmation can never carry over to another job.
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<number | null>(null);

  const jobs = useMemo(
    () =>
      [...transport.jobs].sort(
        (a, b) =>
          JOB_STATES.indexOf(jobState(a) ?? "Requested") - JOB_STATES.indexOf(jobState(b) ?? "Requested") ||
          a.urgency - b.urgency ||
          (sinceStep(a) ?? 0) - (sinceStep(b) ?? 0),
      ),
    [transport.jobs],
  );
  const q = query.trim().toLowerCase();
  const rows = jobs.filter((movement) => {
    const job = movement.transport;
    if (!job) return false;
    if (provider !== "all" && job.provider !== provider) return false;
    if (filter === "escort" && !job.escortRequired) return false;
    if (filter === "noCad" && job.cadNumber) return false;
    if (JOB_STATES.includes(filter as JobState) && jobState(movement) !== filter) return false;
    if (!q) return true;
    const to = units.find((unit) => unit.id === movement.acceptedUnitId)?.name ?? "";
    return [movement.id, patientInitials(movement, world), edShort(movement.originEdId), to, job.cadNumber ?? ""].some(
      (text) => text.toLowerCase().includes(q),
    );
  });
  // Once a job is chosen the sheet stays on it, even when a step moves it out of the filter, so
  // the next click can never land on a different patient. A delivered job leaves the sheet empty.
  const selected = selectedId ? jobs.find((movement) => movement.id === selectedId) : rows[0];
  const selectedState = selected ? jobState(selected) : undefined;
  const destination = selected ? units.find((unit) => unit.id === selected.acceptedUnitId) : undefined;
  const who = selected ? patientInitials(selected, world) : undefined;
  const step = STEPS.find((entry) => entry.from === selectedState);
  const blocked =
    selected && step
      ? step.event === "TRANSPORT_ACCEPTED"
        ? acceptedBlockedReason(selected, who)
        : step.event === "TRANSPORT_EN_ROUTE"
          ? enRouteBlockedReason(selected, who)
          : step.event === "PATIENT_COLLECTED"
            ? collectedBlockedReason(selected, who)
            : arrivedBlockedReason(selected, destination, who)
      : undefined;

  const officerRefusals = rejections.filter((rejection) => REFUSAL_LABEL[rejection.attempted] !== undefined).reverse();
  const latest = baseline !== null && rejections.length > baseline ? rejections.at(-1) : undefined;
  // Only the job the refusal was for shows it; another patient's sheet must not read as refused.
  const newRefusal = latest && latest.movementId === selected?.id ? latest : undefined;
  const confirmDelivery = confirmFor !== null && confirmFor === selected?.id && step?.event === "PATIENT_ARRIVED";
  const cancelled = scoped.flatMap((movement) =>
    (movement.unwinds ?? [])
      .filter((unwind) => unwind.kind === "transport_cancelled")
      .map((unwind) => ({ movement, unwind })),
  );

  const runStep = () => {
    if (!selected || !step || blocked) return;
    if (step.event === "PATIENT_ARRIVED" && !confirmDelivery) {
      setSelectedId(selected.id);
      setConfirmFor(selected.id);
      return;
    }
    setBaseline(rejections.length);
    // One literal type per call, so the override-surface guard can read every transport event.
    if (step.event === "TRANSPORT_ACCEPTED")
      dispatch({ type: "TRANSPORT_ACCEPTED", role: "officer", now, movementId: selected.id });
    else if (step.event === "TRANSPORT_EN_ROUTE")
      dispatch({ type: "TRANSPORT_EN_ROUTE", role: "officer", now, movementId: selected.id });
    else if (step.event === "PATIENT_COLLECTED")
      dispatch({ type: "PATIENT_COLLECTED", role: "officer", now, movementId: selected.id });
    else dispatch({ type: "PATIENT_ARRIVED", role: "officer", now, movementId: selected.id });
    setConfirmFor(null);
    setSelectedId(selected.id);
    setMessage(`${step.label} recorded for ${who}.`);
  };

  const providers = TRANSPORT_PROVIDERS.map((name) => {
    const own = transport.jobs.filter((movement) => movement.transport?.provider === name);
    return {
      name,
      requested: own.filter((movement) => jobState(movement) === "Requested").length,
      accepted: own.filter((movement) => jobState(movement) === "Accepted").length,
      onRoad: own.filter((movement) => jobState(movement) === "En route" || jobState(movement) === "Collected").length,
      total: own.length,
    };
  });

  const toggle = (next: Filter) => ({
    pressed: filter === next,
    onSelect: () => {
      setFilter(filter === next ? "all" : next);
      setSelectedId(undefined);
      setConfirmFor(null);
    },
  });

  const attention: Attention[] = [
    ...(transport.byState.Requested
      ? [
          {
            label: `${transport.byState.Requested} waiting for a provider`,
            tone: "warn" as const,
            onClick: () => setFilter("Requested"),
          },
        ]
      : []),
    ...(transport.escort
      ? [
          {
            label: `${plural(transport.escort, "job needs", "jobs need")} a clinical escort`,
            tone: "warn" as const,
            onClick: () => setFilter("escort"),
          },
        ]
      : []),
    ...(transport.noCad
      ? [
          {
            label: `${plural(transport.noCad, "job has", "jobs have")} no dispatch (CAD) number`,
            tone: "info" as const,
            onClick: () => setFilter("noCad"),
          },
        ]
      : []),
    ...(officerRefusals.length
      ? [{ label: `${plural(officerRefusals.length, "step")} not recorded this session`, tone: "warn" as const }]
      : []),
  ];

  return (
    <main id="main-content" className={styles.page} data-testid="transport-hub">
      <FlowHeader
        crumbs={[{ label: "Service hubs" }, { label: "Transport Hub" }]}
        title="Transport Hub"
        badges={<Pill tone="quiet">{scopeLabel}</Pill>}
        asAt={asAt}
        actions={
          <>
            <button className={styles.textButton} type="button" onClick={() => setMessage(NOT_WIRED)}>
              Dispatch comms
            </button>
            <a className={styles.textButton} href={FLOW_ROUTES.officerView}>
              Officer view
            </a>
            <a className={styles.textButton} href={FLOW_ROUTES.board}>
              Movements
            </a>
          </>
        }
      />

      <Verdict attention={attention}>
        <strong>{plural(transport.jobs.length, "transport job is", "transport jobs are")} open:</strong>{" "}
        {transport.byState.Requested} waiting for a provider, {transport.byState.Accepted} accepted but not yet left,{" "}
        {transport.byState["En route"]} on the way to collect and {transport.byState.Collected} with the patient on
        board.
      </Verdict>

      <p className={message && !newRefusal ? styles.toast : styles.srOnly} role="status">
        {newRefusal ? "" : message}
      </p>

      <KpiStrip
        label="Transport job figures"
        items={[
          ...JOB_STATES.map((state) => ({
            label: JOB_STATE_LABEL[state].label,
            value: transport.byState[state],
            tone: state === "Requested" && transport.byState[state] ? ("warn" as const) : undefined,
            note: JOB_STATE_LABEL[state].meaning,
            ...toggle(state),
          })),
          {
            label: "Escort required",
            value: transport.escort,
            tone: transport.escort ? ("warn" as const) : undefined,
            note: "Clinical escort recorded on the job",
            ...toggle("escort"),
          },
        ]}
      />

      <div className={styles.grid2}>
        <Panel
          title="Transport jobs"
          question="Earliest state first, then most urgent. Select a job to work it."
          meta={`${rows.length} shown of ${transport.jobs.length}`}
          flush
          foot={
            filter !== "all" || provider !== "all" || q ? (
              <>
                <span>Filtered.</span>
                <button
                  className={styles.linkButton}
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setProvider("all");
                    setQuery("");
                  }}
                >
                  Show every job
                </button>
              </>
            ) : undefined
          }
        >
          <div className={styles.toolbar}>
            <div className={styles.toolbarGroup}>
              <label className={styles.srOnly} htmlFor="transport-proposal-search">
                Search transport jobs
              </label>
              <input
                id="transport-proposal-search"
                className={styles.search}
                type="search"
                placeholder="Search initials, WF number, ED, ward or CAD"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <label className={styles.srOnly} htmlFor="transport-proposal-provider">
                Provider
              </label>
              <select
                id="transport-proposal-provider"
                className={styles.select}
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
              >
                <option value="all">All providers</option>
                {providers.map((entry) => (
                  <option key={entry.name} value={entry.name}>
                    {entry.name} ({entry.total})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {rows.length === 0 ? (
            <div className={styles.panelBody}>
              <p className={styles.empty}>No transport job matches this filter.</p>
            </div>
          ) : (
            <div className={styles.tableScroll} role="region" aria-label="Transport jobs table" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">State</th>
                    <th scope="col">From and to</th>
                    <th scope="col">Escort</th>
                    <th scope="col" className={styles.num}>
                      In this state
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((movement) => {
                    const state = jobState(movement);
                    const job = movement.transport;
                    const since = sinceStep(movement);
                    return (
                      <tr key={movement.id}>
                        <td>
                          <span className={styles.rowName}>
                            <button
                              className={styles.rowLink}
                              type="button"
                              aria-pressed={selected?.id === movement.id}
                              onClick={() => {
                                setSelectedId(movement.id);
                                setConfirmFor(null);
                              }}
                            >
                              {patientInitials(movement, world)}
                            </button>
                            <span className={styles.rowSub}>{movement.id}</span>
                          </span>
                        </td>
                        <td>
                          <Pill tone={stateTone(state)}>{state ? JOB_STATE_LABEL[state].label : "Not open"}</Pill>
                        </td>
                        <td>
                          <span className={styles.route}>
                            <span>{edShort(movement.originEdId)}</span>
                            <span className={styles.routeTo}>
                              → {units.find((unit) => unit.id === movement.acceptedUnitId)?.name ?? "No ward recorded"}
                            </span>
                          </span>
                        </td>
                        <td>
                          {job?.escortRequired ? (
                            <Pill tone="warn">Required</Pill>
                          ) : (
                            <span className={styles.rowSub}>None</span>
                          )}
                        </td>
                        <td className={styles.num}>
                          {since !== undefined ? waited(now - since) : "Start not recorded"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className={styles.stack}>
          {selected && selected.transport ? (
            <Panel
              title={`Job sheet · ${who}`}
              question={`${selected.id} · ${selected.transport.provider}`}
              meta={<Pill tone={tierTone(selected.urgency)}>{urgencyTierLabel(selected.urgency)}</Pill>}
              foot={<a href={FLOW_ROUTES.movement(selected.id)}>Open movement</a>}
            >
              <ol className={styles.jobSteps} aria-label="Job steps">
                {JOB_STATES.map((state, index) => {
                  const at = JOB_STATES.indexOf(selectedState ?? "Requested");
                  return (
                    <li
                      key={state}
                      className={`${styles.jobStep} ${index < at ? styles.jobStepDone : index === at ? styles.jobStepNow : ""}`}
                      aria-current={index === at ? "step" : undefined}
                    >
                      {state === "Collected" ? "Patient on board" : state === "En route" ? "On the way" : state}
                    </li>
                  );
                })}
              </ol>
              <dl className={styles.facts}>
                <div className={styles.fact}>
                  <dt>From</dt>
                  <dd>{edShort(selected.originEdId)}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>To</dt>
                  <dd>{destination?.name ?? "No ward recorded"}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>Provider</dt>
                  <dd>{selected.transport.provider}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>Escort</dt>
                  <dd>{selected.transport.escortRequired ? "Clinical escort required" : "Not required"}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>Transport form</dt>
                  <dd>
                    {selected.transport.formRequired
                      ? `${selected.transport.formRequired} (recorded)`
                      : "None recorded"}
                  </dd>
                </div>
                <div className={styles.fact}>
                  <dt>Dispatch (CAD) number</dt>
                  <dd>{selected.transport.cadNumber ?? "Not recorded"}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>Estimated time</dt>
                  <dd>
                    {selected.transport.estimatedAt !== undefined
                      ? transportEtaRemainingLabel(selected.transport.estimatedAt, now)
                      : "Not recorded"}
                  </dd>
                </div>
                <div className={styles.fact}>
                  <dt>Legal status for transport</dt>
                  <dd>
                    {selected.transport.transportLegalStatus
                      ? selected.transport.transportLegalStatus === "voluntary"
                        ? "Voluntary"
                        : "Involuntary"
                      : "Not recorded"}
                  </dd>
                </div>
              </dl>
              {step ? (
                <>
                  <p className={styles.note}>
                    <button
                      className={styles.buttonPrimary}
                      type="button"
                      disabled={blocked !== undefined}
                      onClick={runStep}
                    >
                      {confirmDelivery ? `Confirm delivered to ${destination?.name ?? "the ward"}` : step.label}
                    </button>{" "}
                    {confirmDelivery ? (
                      <button className={styles.textButton} type="button" onClick={() => setConfirmFor(null)}>
                        Cancel
                      </button>
                    ) : null}
                  </p>
                  {blocked ? <p className={styles.blocked}>Not available yet: {blocked}</p> : null}
                  {confirmDelivery ? (
                    <p className={styles.blocked}>No receiving nurse signature is recorded in this prototype.</p>
                  ) : null}
                </>
              ) : null}
              {newRefusal ? (
                <p className={styles.refused} role="alert">
                  Not recorded. {plainRefusal(newRefusal.reason)}
                </p>
              ) : null}
              <p className={styles.note}>
                <button className={styles.textButton} type="button" onClick={() => setMessage(NOT_WIRED)}>
                  Check the form
                </button>
              </p>
            </Panel>
          ) : (
            <Panel title="Job sheet">
              <p className={styles.empty}>
                {selectedId && !selected
                  ? "That job is delivered and has left the open list. Select the next job."
                  : "Select a job to see its details and next step."}
              </p>
            </Panel>
          )}

          <Panel title="By provider" question="Open jobs for each provider. Choose one to filter.">
            <ul className={styles.list}>
              {providers.map((entry) => (
                <li key={entry.name} className={styles.listRow}>
                  <button
                    className={styles.rowLink}
                    type="button"
                    aria-pressed={provider === entry.name}
                    onClick={() => setProvider(provider === entry.name ? "all" : entry.name)}
                  >
                    {entry.name}
                    <span className={styles.checkSub}>
                      {entry.requested} waiting · {entry.accepted} accepted · {entry.onRoad} on the road
                    </span>
                  </button>
                  <strong className={styles.num}>{entry.total}</strong>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <div className={styles.grid2Even}>
        <Panel
          title="Refused actions"
          question="Steps the engine refused this session, newest first."
          meta={`${officerRefusals.length}`}
        >
          {officerRefusals.length === 0 ? (
            <p className={styles.empty}>No transport step has been refused this session.</p>
          ) : (
            <ul className={styles.list}>
              {officerRefusals.slice(0, 8).map((rejection) => {
                const movement = world.movements.find((candidate) => candidate.id === rejection.movementId);
                return (
                  <li key={rejection.id} className={styles.listRow}>
                    <span>
                      {REFUSAL_LABEL[rejection.attempted]} for{" "}
                      {movement ? patientInitials(movement, world) : rejection.movementId}
                      <span className={styles.checkSub}>{plainRefusal(rejection.reason)}</span>
                    </span>
                    <span className={styles.num}>{formatInstantWithDay(rejection.at, now)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel
          title="Cancelled and stood down"
          question="Transport jobs cancelled after booking."
          meta={`${cancelled.length}`}
        >
          {cancelled.length === 0 ? (
            <p className={styles.empty}>No transport job has been cancelled.</p>
          ) : (
            <ul className={styles.list}>
              {cancelled.map(({ movement, unwind }) => (
                <li key={`${movement.id}-${unwind.at}`} className={styles.listRow}>
                  <span>
                    {patientInitials(movement, world)} · {movement.id}
                    <span className={styles.checkSub}>
                      {(unwind.reason && changeReasonLabels[unwind.reason as keyof typeof changeReasonLabels]) ||
                        "Reason not recorded"}
                    </span>
                  </span>
                  <span className={styles.num}>{formatInstantWithDay(unwind.at, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Definitions
        items={[
          {
            term: "Open job",
            meaning:
              "A transport job not yet delivered on a movement that is still open. The movements screen counts the same jobs.",
          },
          {
            term: "Accepted, not yet left",
            meaning:
              'A provider accepted the booking; the vehicle has not been marked en route. This is the engine\'s "awaiting departure".',
          },
          {
            term: "In this state",
            meaning:
              'Time since the step that put the job in its current state. A waiting request shows "Start not recorded" because no job records when it was requested.',
          },
          { term: "Delivered", meaning: "The officer's word for the arrival event. Other screens call it Arrived." },
        ]}
      />
    </main>
  );
}
