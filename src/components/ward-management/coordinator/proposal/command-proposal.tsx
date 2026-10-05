"use client";

import { ChevronDown, CircleAlert, Clock3, X } from "lucide-react";
import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { ignoreUnavailableActivation } from "@/components/primitive-recipes/recipes";
import { answerSilenceReminder } from "@/components/ward-management/delays/delays-derivations";
import {
  clockState,
  formatInstant,
  formatInstantWithDay,
  splitDuration,
} from "@/components/ward-management/ward-clock";
import { allDeclines, allOverrides, isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { operationalScore, queueOrder, urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import {
  healthServiceAcronym,
  movementBelongsToService,
  referralBelongsToService,
} from "@/components/ward-management/ward-service-scope";
import { allEmergencyDepartments, edShortName } from "@/components/ward-management/ward-sites";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";

import { ExceptionDrawer } from "../exception-drawer";
import { FlowDiagram } from "../flow-diagram";
import { ReferralPlacementPanel, ShortlistPanel } from "../shortlist-panel";
import { SinceLastLookPanel } from "../since-last-look-panel";
import { commandFigures, people, type EdRow } from "./command-proposal-figures";
import styles from "./command-proposal.module.css";

const NOT_WIRED = "Not wired in this prototype.";

/**
 * Command redesign proposal, preview route only. Reads and writes the same shared Ward Flow state
 * as the live Command screen and reuses its shortlist, flow diagram and registers unchanged; only
 * the page around them is new. The live screen (`coordinator-screen.tsx`) is untouched.
 */
export function CommandProposal() {
  const {
    movements,
    units,
    bedReleases,
    leaveBeds,
    admissions,
    rejections,
    referrals,
    dispatch,
    configuration,
    scenario,
  } = useWardFlow();
  const now = useWardFlowClock();
  const service = useServiceScope();
  const patientOf = usePatientOf();

  const [tab, setTab] = useState<"patients" | "referrals">("patients");
  const [edFilter, setEdFilter] = useState<string | undefined>(undefined);
  const [movementId, setMovementId] = useState<string | undefined>(undefined);
  const [referralId, setReferralId] = useState<string | undefined>(undefined);
  const [unitId, setUnitId] = useState<string | undefined>(undefined);
  const [showDiagram, setShowDiagram] = useState(false);
  const [registersOpen, setRegistersOpen] = useState(false);
  const [showAllAttention, setShowAllAttention] = useState(false);

  const figures = useMemo(
    () => commandFigures({ movements, units, referrals, bedReleases, leaveBeds, now }),
    [movements, units, referrals, bedReleases, leaveBeds, now],
  );

  const inService = (movement: Movement) => service === null || movementBelongsToService(movement, service, units);
  const queue = queueOrder(
    movements.filter((movement) => (!edFilter || movement.originEdId === edFilter) && inService(movement)),
    now,
  );
  const referralQueue = referralQueueOrder(referrals).filter(
    (referral: Referral) => service === null || referralBelongsToService(referral, service, units),
  );

  const selectedMovement = movementId ? movements.find((m) => m.id === movementId && isOpen(m)) : undefined;
  const selectedReferral = referralId ? referralQueue.find((r) => r.id === referralId) : undefined;
  const filterEd = edFilter ? allEmergencyDepartments().find((ed) => ed.id === edFilter) : undefined;

  function selectMovement(id: string | undefined) {
    setMovementId(id);
    setReferralId(undefined);
    setUnitId(undefined);
  }
  function selectReferral(id: string) {
    setReferralId(id);
    setMovementId(undefined);
  }
  function closePanel() {
    setMovementId(undefined);
    setReferralId(undefined);
    setUnitId(undefined);
  }
  function onTabsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tab === "patients" ? "referrals" : "patients";
    setTab(next);
    document.getElementById(`command-proposal-tab-${next}`)?.focus();
  }

  const attentionNow = figures.attention.filter((item) => item.tone === "danger");
  const attentionShown = showAllAttention ? figures.attention : figures.attention.slice(0, 4);
  const silenceReminders = useMemo(() => {
    const notes = new Map<string, string>();
    for (const movement of movements.filter(isOpen)) {
      const copy = answerSilenceReminder(movement, referrals, now);
      if (copy !== undefined) notes.set(movement.id, copy);
    }
    return notes;
  }, [movements, referrals, now]);
  const overrides = useMemo(() => allOverrides(movements), [movements]);
  const declines = useMemo(() => allDeclines(movements), [movements]);
  const lastLookWorld = useMemo(
    () => ({ scenario, referrals, movements, units, bedReleases }),
    [scenario, referrals, movements, units, bedReleases],
  );
  const maxWait = Math.max(1, ...figures.eds.map((row) => row.longestWaitMinutes));
  const hasPanelSubject = Boolean(selectedMovement || selectedReferral);

  return (
    <div className={styles.page} data-testid="command-proposal">
      <header className={styles.header}>
        <div>
          <p className={styles.crumbs}>Ward Flow · Flow coordinator</p>
          <h1 className={styles.title}>Command</h1>
        </div>
        <p className={styles.asAt}>
          <span>As at {formatInstant(now)} board time</span>
          <span aria-hidden="true">·</span>
          <span>{service ? `${service} only` : "All services"}</span>
          <span aria-hidden="true">·</span>
          <span>Synthetic data</span>
        </p>
      </header>

      {/* The one-sentence answer to the screen's question: who is waiting, for what, and how much needs a person now. */}
      <section className={styles.answer} aria-label="Summary">
        <p className={styles.answerLine} data-testid="command-proposal-answer">
          {people(figures.waitingInEd)} waiting in {figures.departmentsWithWaiting} emergency departments,{" "}
          {figures.readyBeds} beds ready now.{" "}
          {attentionNow.length > 0 ? (
            <strong className={styles.answerAlert}>{attentionNow.length} need action now.</strong>
          ) : (
            <span>Nothing needs action now.</span>
          )}
        </p>
        <dl className={styles.figures} aria-label="Key figures">
          <Figure
            label="Waiting in ED"
            value={figures.waitingInEd}
            note={
              figures.longest
                ? `Longest ${splitDuration(figures.longest.minutes)} at ${figures.longest.edCode}`
                : "Nobody waiting"
            }
          />
          <Figure
            label="Beds ready now"
            value={figures.readyBeds}
            note={`${figures.confirmedToday} confirmed and ${figures.expectedToday} expected to free today`}
          />
          <Figure label="Referrals awaiting a decision" value={figures.referralsAwaiting} note="Across all services" />
          <Figure
            label="At a time limit or nowhere to go"
            value={figures.severeDelays}
            note="Same count as Delays"
            warn={figures.severeDelays > 0}
          />
          <Figure
            label="Discharges held up today"
            value={figures.blockedToday}
            note="Counted within confirmed and expected"
            warn={figures.blockedToday > 0}
          />
        </dl>
      </section>

      {figures.attention.length > 0 ? (
        <section className={styles.panel} aria-labelledby="command-attention-title">
          <div className={styles.panelHead}>
            <h2 id="command-attention-title" className={styles.panelTitle}>
              Needs attention now
            </h2>
            <span className={styles.panelMeta}>
              {figures.attention.length} item{figures.attention.length === 1 ? "" : "s"}, most serious first
            </span>
          </div>
          <ul className={styles.list}>
            {attentionShown.map((item) => {
              const movement = movements.find((m) => m.id === item.movementId);
              return (
                <li key={item.id} className={styles.attentionRow}>
                  <CircleAlert
                    aria-hidden="true"
                    strokeWidth={1.6}
                    className={item.tone === "danger" ? styles.iconDanger : styles.iconWarn}
                  />
                  <div className={styles.rowText}>
                    <p className={styles.rowTitle}>
                      {item.title}
                      <span className={styles.srOnly}>{item.tone === "danger" ? " (serious)" : " (warning)"}</span>
                    </p>
                    <p className={styles.rowDetail}>
                      {movement ? `${patientOf(movement).formalName} · ` : ""}
                      {item.detail} · {item.owner}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => {
                      setTab("patients");
                      selectMovement(item.movementId);
                    }}
                  >
                    Open
                  </button>
                </li>
              );
            })}
          </ul>
          {figures.attention.length > 4 ? (
            <button
              type="button"
              className={styles.footButton}
              aria-expanded={showAllAttention}
              onClick={() => setShowAllAttention((value) => !value)}
            >
              {showAllAttention ? "Show fewer" : `Show all ${figures.attention.length}`}
            </button>
          ) : null}
        </section>
      ) : null}

      <SinceLastLookPanel world={lastLookWorld} now={now} />

      <div className={styles.grid} data-panel-open={hasPanelSubject}>
        <section className={styles.panel} aria-labelledby="command-queue-title">
          <div className={styles.panelHead}>
            <h2 id="command-queue-title" className={styles.panelTitle}>
              Priority queue
            </h2>
            <span className={styles.panelMeta}>Flagged urgent first, then most urgent tier, then longest wait</span>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Queue" onKeyDown={onTabsKeyDown}>
            {(["patients", "referrals"] as const).map((key) => (
              <button
                key={key}
                id={`command-proposal-tab-${key}`}
                type="button"
                role="tab"
                aria-selected={tab === key}
                aria-controls={`command-proposal-panel-${key}`}
                tabIndex={tab === key ? 0 : -1}
                className={styles.tab}
                onClick={() => setTab(key)}
              >
                {key === "patients" ? "Patients" : "Referrals"}
                <span className={styles.tabCount}>{key === "patients" ? queue.length : referralQueue.length}</span>
              </button>
            ))}
          </div>

          {tab === "patients" && filterEd ? (
            <p className={styles.filterNote}>
              Showing patients from {edShortName(filterEd)} only.
              <button type="button" className={styles.textButton} onClick={() => setEdFilter(undefined)}>
                Show all departments
              </button>
            </p>
          ) : null}

          <div
            id="command-proposal-panel-patients"
            role="tabpanel"
            aria-labelledby="command-proposal-tab-patients"
            hidden={tab !== "patients"}
            className={styles.queueScroll}
          >
            <div className={styles.queueHead} aria-hidden="true">
              <span>Patient</span>
              <span>Urgency</span>
              <span>Waiting</span>
              <span>From</span>
              <span title="How badly this movement is going operationally. Not clinical severity, acuity or risk.">
                Operational score
              </span>
            </div>
            {queue.length === 0 ? (
              <p className={styles.empty}>Nobody is waiting{filterEd ? " at this department" : ""}.</p>
            ) : (
              <ul className={styles.list}>
                {queue.map((movement) => {
                  const ed = allEmergencyDepartments().find((candidate) => candidate.id === movement.originEdId);
                  const dueAt = movement.legalForm?.dueAt;
                  const due = dueAt !== undefined ? clockState(dueAt, now) : undefined;
                  const selected = movement.id === movementId;
                  return (
                    <li key={movement.id}>
                      <button
                        type="button"
                        className={styles.queueRow}
                        aria-pressed={selected}
                        data-testid={`command-proposal-row-${movement.id}`}
                        onClick={() => selectMovement(selected ? undefined : movement.id)}
                      >
                        <span className={styles.queueName}>
                          <strong>{patientOf(movement).formalName}</strong>
                          <span className={styles.rowDetail}>
                            {movement.cohort} · {movement.security}
                            {dueAt !== undefined ? (
                              <span
                                className={
                                  due === "breached" || due === "critical"
                                    ? styles.textDanger
                                    : due === "due"
                                      ? styles.textWarn
                                      : undefined
                                }
                              >
                                {" "}
                                · Form due {formatInstantWithDay(dueAt, now)}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className={styles.queueUrgency}>
                          <span>{urgencyTierLabel(movement.urgency)}</span>
                          {movement.flaggedUrgent ? (
                            <span className={styles.textDanger}>
                              Flagged urgent{movement.urgentFlag ? "" : ", source not recorded"}
                            </span>
                          ) : null}
                        </span>
                        <span className={styles.num}>{splitDuration(Math.max(now - movement.openedAt, 0))}</span>
                        <span>{ed ? edShortName(ed) : "Unknown ED"}</span>
                        <span className={styles.num}>{operationalScore(movement, now).score}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            id="command-proposal-panel-referrals"
            role="tabpanel"
            aria-labelledby="command-proposal-tab-referrals"
            hidden={tab !== "referrals"}
            className={styles.queueScroll}
          >
            {referralQueue.length === 0 ? (
              <p className={styles.empty}>No referrals awaiting a decision.</p>
            ) : (
              <ul className={styles.list}>
                {referralQueue.map((referral) => {
                  const selected = referral.id === referralId;
                  return (
                    <li key={referral.id}>
                      <button
                        type="button"
                        className={styles.queueRow}
                        aria-pressed={selected}
                        onClick={() => (selected ? closePanel() : selectReferral(referral.id))}
                      >
                        <span className={styles.queueName}>
                          <strong>{referral.id}</strong>
                          <span className={styles.rowDetail}>
                            {referral.ageBand} · {referral.homeRegion}
                          </span>
                        </span>
                        <span className={styles.queueUrgency}>{urgencyTierLabel(referral.urgency)}</span>
                        <span className={styles.num}>{splitDuration(Math.max(now - referral.raisedAt, 0))}</span>
                        <span>{referral.originSiteCode}</span>
                        <span className={styles.num} aria-hidden="true">
                          –
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {hasPanelSubject ? (
          <aside
            className={`${styles.panel} ${styles.subjectPanel}`}
            aria-label={selectedReferral ? "Referral placement" : "Explainable shortlist"}
          >
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>{selectedReferral ? "Referral placement" : "Where can they go?"}</h2>
              <button
                type="button"
                className={styles.iconButton}
                onClick={closePanel}
                aria-label="Close and clear selection"
              >
                <X aria-hidden="true" strokeWidth={1.6} />
              </button>
            </div>
            {service ? (
              <p className={styles.note}>
                Beds are never narrowed by service. Every ward in the network is considered.
              </p>
            ) : null}
            <div className={styles.subjectBody}>
              {selectedReferral ? (
                <ReferralPlacementPanel referral={selectedReferral} now={now} />
              ) : (
                <ShortlistPanel
                  movement={selectedMovement}
                  now={now}
                  units={units}
                  bedReleases={bedReleases}
                  leaveBeds={leaveBeds}
                  admissions={admissions}
                  referrals={referrals}
                  selectedUnitId={unitId}
                  onSelectUnit={setUnitId}
                  dispatch={dispatch}
                  parallelReferralCap={configuration.parallelReferralCap}
                  pullHoldMinutes={configuration.pullHoldMinutes}
                />
              )}
            </div>
          </aside>
        ) : (
          <div className={styles.side}>
            <section className={styles.panel} aria-labelledby="command-eds-title">
              <div className={styles.panelHead}>
                <h2 id="command-eds-title" className={styles.panelTitle}>
                  Emergency departments
                </h2>
                <span className={styles.panelMeta}>Select one to filter the queue</span>
              </div>
              <ul className={styles.list}>
                {figures.eds.map((row) => (
                  <EdLine
                    key={row.id}
                    row={row}
                    maxWait={maxWait}
                    selected={row.id === edFilter}
                    onSelect={() => {
                      setTab("patients");
                      setEdFilter((current) => (current === row.id ? undefined : row.id));
                    }}
                  />
                ))}
              </ul>
              <p className={styles.panelFootnote}>
                Bars show the longest wait. Status shows only form due times someone typed; none are calculated.
              </p>
            </section>

            <section className={styles.panel} aria-labelledby="command-beds-title">
              <div className={styles.panelHead}>
                <h2 id="command-beds-title" className={styles.panelTitle}>
                  Beds by health service
                </h2>
                <span className={styles.panelMeta}>Ready now · to free today</span>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Service</th>
                    <th scope="col">Wards</th>
                    <th scope="col">Ready now</th>
                    <th scope="col">Confirmed</th>
                    <th scope="col">Expected</th>
                    <th scope="col">Held up</th>
                  </tr>
                </thead>
                <tbody>
                  {figures.services.map((row) => (
                    <tr key={row.service}>
                      <th scope="row">{healthServiceAcronym(row.service) || row.service}</th>
                      <td>{row.wards}</td>
                      <td>{row.ready}</td>
                      <td>{row.confirmedToday}</td>
                      <td>{row.expectedToday}</td>
                      <td className={row.blockedToday > 0 ? styles.textWarn : undefined}>{row.blockedToday}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">All</th>
                    <td>{figures.services.reduce((total, row) => total + row.wards, 0)}</td>
                    <td data-testid="command-proposal-ready-total">{figures.readyBeds}</td>
                    <td>{figures.confirmedToday}</td>
                    <td>{figures.expectedToday}</td>
                    <td>{figures.blockedToday}</td>
                  </tr>
                </tfoot>
              </table>
            </section>
          </div>
        )}
      </div>

      <section className={styles.panel} aria-labelledby="command-flow-title">
        <div className={styles.panelHead}>
          <h2 id="command-flow-title" className={styles.panelTitle}>
            Statewide flow
          </h2>
          <button
            type="button"
            className={styles.textButton}
            aria-expanded={showDiagram}
            onClick={() => setShowDiagram((value) => !value)}
          >
            {showDiagram ? "Hide diagram" : `Show all ${units.length} wards`}
            <ChevronDown
              aria-hidden="true"
              strokeWidth={1.6}
              className={showDiagram ? styles.chevronOpen : styles.chevron}
            />
          </button>
        </div>
        {showDiagram ? (
          <div className={styles.diagram}>
            <FlowDiagram
              movement={selectedMovement}
              movements={movements}
              now={now}
              units={units}
              bedReleases={bedReleases}
              leaveBeds={leaveBeds}
              admissions={admissions}
              selectedUnitId={unitId}
              onSelectUnit={(id) => setUnitId((current) => (current === id ? undefined : id))}
              parallelReferralCap={configuration.parallelReferralCap}
              service={service}
            />
          </div>
        ) : (
          <p className={styles.collapsedNote}>
            Every ward&apos;s ready, pulled, closed and occupied beds, and the path for a selected patient. Schematic,
            not geographic.
          </p>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="command-registers-title">
        <div className={styles.panelHead}>
          <h2 id="command-registers-title" className={styles.panelTitle}>
            Registers
          </h2>
          <span className={styles.panelMeta}>
            {declines.length} declines · {overrides.length} overrides · {figures.attention.length} exceptions ·{" "}
            {rejections.length} refused actions
          </span>
        </div>
        <div className={styles.registers}>
          <ExceptionDrawer
            items={figures.attention}
            silenceReminders={silenceReminders}
            rejections={rejections}
            overrides={overrides}
            declines={declines}
            units={units}
            now={now}
            open={registersOpen}
            onToggle={() => setRegistersOpen((open) => !open)}
            onSelectMovement={(id) => {
              setTab("patients");
              selectMovement(id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.textButton}
          aria-disabled="true"
          onClick={ignoreUnavailableActivation}
          title={NOT_WIRED}
          aria-describedby="command-not-wired"
        >
          Export queue as CSV
        </button>
        <span id="command-not-wired" className={styles.rowDetail}>
          {NOT_WIRED}
        </span>
        <span className={styles.rowDetail}>
          <Clock3 aria-hidden="true" strokeWidth={1.6} className={styles.inlineIcon} /> Figures follow the board clock
          and update as the board changes.
        </span>
      </div>

      <WardPrototypeFooter
        testId="command-proposal-footer"
        note="Command redesign preview · Synthetic data · Not a medical device"
      />
    </div>
  );
}

function Figure({ label, value, note, warn = false }: { label: string; value: number; note: string; warn?: boolean }) {
  return (
    <div className={styles.figure}>
      <dt className={styles.figureLabel}>{label}</dt>
      <dd className={`${styles.figureValue} ${warn ? styles.textWarn : ""}`}>{value}</dd>
      <dd className={styles.figureNote}>{note}</dd>
    </div>
  );
}

function EdLine({
  row,
  maxWait,
  selected,
  onSelect,
}: {
  row: EdRow;
  maxWait: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const status =
    row.waiting === 0
      ? { text: "Nobody waiting", tone: undefined }
      : row.deadline.state === "breached"
        ? { text: `${row.deadline.count} form overdue`, tone: styles.textDanger }
        : row.deadline.state === "critical" || row.deadline.state === "due"
          ? { text: `${row.deadline.count} form due soon`, tone: styles.textWarn }
          : row.deadline.state === "clear"
            ? { text: `${row.deadline.count} form, not due yet`, tone: undefined }
            : { text: "No form due time", tone: undefined };
  const share = row.waiting === 0 ? 0 : Math.max(2, Math.round((row.longestWaitMinutes / maxWait) * 100));
  return (
    <li>
      <button
        type="button"
        className={styles.edRow}
        aria-pressed={selected}
        onClick={onSelect}
        aria-label={`${row.name}: ${row.waiting} waiting, longest ${splitDuration(row.longestWaitMinutes)}, ${status.text}`}
        title={row.name}
      >
        <span className={styles.edName}>
          {edShortName({ id: row.id, siteCode: row.siteCode, name: row.name })}
          <span className={styles.rowDetail}>{healthServiceAcronym(row.service)}</span>
        </span>
        <span className={styles.num}>{row.waiting}</span>
        <span className={styles.edWait}>
          <span className={styles.num}>{row.waiting === 0 ? "–" : splitDuration(row.longestWaitMinutes)}</span>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} style={{ width: `${share}%` }} />
          </span>
        </span>
        <span className={`${styles.edStatus} ${status.tone ?? ""}`}>{status.text}</span>
      </button>
    </li>
  );
}
