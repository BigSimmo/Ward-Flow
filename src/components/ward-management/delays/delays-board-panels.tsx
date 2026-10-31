"use client";

// The Delays board's side rail: the person's panel for the open row, and the registers it replaces
// (escalated, attention, closed today). Split out of delays-board.tsx to keep that file under the
// line cap.
import { useMemo, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { formatInstantWithDay, type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import { stageCopy } from "@/components/ward-management/ward-derivations";
import { useDueSoonThresholds, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  type Movement,
  type Unit,
} from "@/components/ward-management/ward-model";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { TierTile, useIsPhone } from "@/components/wf";
import { answerSilenceReminder, isCleared } from "./delays-derivations";
import { Glyph, causeTitle } from "./delays-board-parts";
import {
  SILENT_MINUTES,
  hoursWord,
  catchmentName,
  dueTone,
  ownerName,
  wardLines,
  candidateWards,
  waitTone,
  type BoardRow,
} from "./delays-board-model";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { movementHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import styles from "./delays-board.module.css";
import { ago, originLabel, rowTypedTime } from "./delays-board-rows";

export function PersonPanel({
  row,
  units,
  now,
  onClose,
  onEscalate,
  panelRef,
}: {
  row: BoardRow;
  units: Unit[];
  now: Instant;
  onClose: () => void;
  onEscalate: (movement: Movement) => void;
  panelRef: RefObject<HTMLElement | null>;
}) {
  const thresholds = useDueSoonThresholds();
  const { referrals, setFocusMovementId } = useWardFlowSelect("referrals", "setFocusMovementId");
  const patientOf = usePatientOf();
  const escalationGate = useRoleGate()("RECORD_ESCALATION");
  const { movement, cause } = row;
  const patient = patientOf(movement);
  const escalation = movement.escalation;
  const triedUnits = (escalation?.triedUnitIds ?? [])
    .map((unitId) => units.find((unit) => unit.id === unitId))
    .filter((unit): unit is Unit => unit !== undefined);
  const blockerText = movement.blocker.trim();
  const activeBlocker =
    blockerText !== "" && !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === blockerText);
  const silenceReminder = answerSilenceReminder(movement, referrals, now);
  const cleared = isCleared(movement, referrals);
  const lines = wardLines(row, units);
  const candidates = useMemo(() => candidateWards(movement, units, now), [movement, units, now]);
  const [unavailableOpen, setUnavailableOpen] = useState(false);
  // v10 phone: a journey bar from arrival to now leads the person sheet.
  const isPhonePanel = useIsPhone();
  const pullHolder = units.find((unit) => unit.id === movement.acceptedUnitId);
  const legalForm = movement.legalForm;

  return (
    <section
      className={`${styles.card} ${styles.side}`}
      aria-label="Why this person is waiting"
      data-ward-primitive="panel"
      data-wf-rail
      data-testid={`delays-detail-${movement.id}`}
      id="delays-person-panel"
      tabIndex={-1}
      ref={panelRef}
    >
      <div className={styles.sideH}>
        <div className={styles.sideTitle}>
          <button type="button" className={styles.lnk} onClick={onClose}>
            Back
          </button>
          <h3 className={styles.ell}>{patient.formalName}</h3>
          <p className={`${styles.sub} ${styles.ell}`} data-testid="delays-panel-sub">
            {[patient.umrn, originLabel(movement), catchmentName(row.origin)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          className={styles.x}
          onClick={onClose}
          aria-label="Close why this person is waiting"
          title="Close (Esc)"
          data-testid="delays-close-detail"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.sideB}>
        {isPhonePanel ? (
          <div className={styles.phJourney} data-testid={`delays-phone-journey-${movement.id}`}>
            <div className={styles.phJourneyBar} aria-hidden="true">
              {row.activity !== undefined && row.waited > 0 ? (
                <span
                  className={styles.phJourneyDone}
                  style={{ flexGrow: Math.max(0, row.waited - row.quiet), flexBasis: 0 }}
                />
              ) : null}
              <span className={styles.phJourneyQuiet} style={{ flexGrow: Math.max(1, row.quiet), flexBasis: 0 }} />
              <span className={styles.phJourneyNow} />
            </div>
            <div className={styles.phJourneyRow}>
              <span>
                <b className={styles.num}>{formatInstantWithDay(movement.openedAt, now)}</b>
                <span className={styles.mute}>Arrived</span>
              </span>
              <span className={styles.phJourneyEnd}>
                <b>
                  <Glyph tone={row.silent ? "warning" : undefined} /> Now
                </b>
                <span className={styles.mute}>
                  {row.activity === undefined
                    ? "Nothing since arrival"
                    : `Last: ${row.activity.what}, ${ago(row.quiet)}`}
                </span>
              </span>
            </div>
          </div>
        ) : null}
        <div className={`${styles.inset} ${styles.causeInset}`}>
          <TierTile tier={movement.urgency} label={urgencyTierLabel(movement.urgency)} />
          <div className={styles.grow}>
            <b className={styles.ellBlock}>{causeTitle(cause)}</b>
            <span className={styles.mute}>{`${ownerName(row.owner)} to clear`}</span>
          </div>
          <span
            className={`${styles.wt} ${styles.num}`}
            data-testid="delays-panel-clock"
            data-urgent={cause === "legal_expiring" || cause === "legal_breached"}
          >
            <Glyph tone={waitTone(row.waited)} />
            {`${splitDuration(row.waited)} in ED`}
          </span>
        </div>

        {cause === "bed_pull_expired" ? (
          <p className={styles.reminder} data-testid={`delays-reserved-time-${movement.id}`}>
            Pull expired, bed still pulled. Release the bed or set a new pull time limit.
          </p>
        ) : null}
        {silenceReminder !== undefined ? (
          <p className={styles.reminder} data-testid={`delays-silence-reminder-${movement.id}`}>
            {silenceReminder}
          </p>
        ) : null}

        {legalForm !== undefined && row.dueIn !== undefined ? (
          <div className={`${styles.inset} ${styles.clock}`} data-testid={`delays-legal-clock-${movement.id}`}>
            <Glyph tone={row.dueIn < 0 ? "danger" : (dueTone(row.dueIn, thresholds) ?? "warning")} />
            <div className={styles.grow}>
              {/* Legal times only as typed (31 Oct 2026): the typed time in words, never a count. */}
              <b>{`${legalFormName(legalForm)} · ${rowTypedTime(row) ?? ""}`}</b>
              <span className={styles.mute}>
                Recorded time <LegalLimitsNotChecked variant="tag" />
              </span>
            </div>
          </div>
        ) : null}

        <dl className={styles.facts}>
          <dt>Last update</dt>
          <dd>
            <Glyph tone={row.silent ? "warning" : undefined} />
            {row.activity === undefined ? "Nothing recorded since arrival" : `${ago(row.quiet)}, ${row.activity.what}`}
          </dd>
          <dt>Bed needed</dt>
          <dd>{row.locked ? "A locked bed" : "An open bed suits"}</dd>
          <dt>Legal status</dt>
          <dd>{movement.legalStatus}</dd>
          <dt>From</dt>
          <dd data-testid="delays-panel-from">{originLabel(movement)}</dd>
          <dt>Stage</dt>
          <dd data-testid="delays-panel-stage">{stageCopy[movement.stage].label}</dd>
          <dt>Held by</dt>
          <dd>{movement.owner}</dd>
        </dl>

        {activeBlocker ? (
          <p className={styles.note} data-testid="delays-blocker">
            <strong>Blocked:</strong> {blockerText}
          </p>
        ) : null}
        {escalation !== undefined ? (
          <p className={styles.note} data-testid="delays-escalation">
            <strong>Escalated {ago(now - escalation.at)}</strong> ({formatInstantWithDay(escalation.at, now)}) to{" "}
            {escalation.contact}
            {triedUnits.length === 0 ? (
              <span data-testid="delays-tried-none">{" · No units recorded"}</span>
            ) : (
              <>
                {" · tried "}
                {triedUnits.map((unit, index) => (
                  <span key={unit.id} data-testid="delays-tried-unit">
                    {index > 0 ? ", " : ""}
                    {unit.name}
                  </span>
                ))}
              </>
            )}
          </p>
        ) : null}

        <p
          className={`${styles.note} ${cleared === false ? styles.noteWarn : ""}`}
          data-testid={`delays-clearance-${movement.id}`}
        >
          <strong>
            {cleared === undefined ? "Not assessed" : cleared ? "Medically cleared" : "Not medically cleared"}
          </strong>{" "}
          {cleared === undefined
            ? "Nobody has recorded whether this person is fit to travel."
            : cleared
              ? "Cleared to travel."
              : "A bed becoming free does not release this person."}
        </p>

        <div className={styles.sec}>
          <h4 className={styles.h4r}>
            Wards
            {movement.declines.length > 0 ? (
              <span className={styles.mut}>{`${movement.declines.length} declined`}</span>
            ) : null}
          </h4>
          {lines.length === 0 ? (
            <p className={styles.mute}>No ward asked yet</p>
          ) : (
            <ul className={styles.wards}>
              {lines.map((line) => (
                <li key={`${line.unitId}-${line.text}`}>
                  <span className={styles.lg}>
                    <Glyph tone={line.tone} />
                    <span className={styles.ell}>{line.name}</span>
                  </span>
                  <small className={styles.ell}>{line.text}</small>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Candidate wards: the coordinator shortlist's own verdicts for the wards not yet asked.
            Eligible and overridable wards are both actionable, so neither is collapsed or cut to a
            count (see shortlistCandidates); the list scrolls instead. Wards no reason can buy sit
            behind a disclosure that states how many, each with the gate that blocks it. */}
        <div className={styles.sec} data-testid={`delays-candidates-${movement.id}`}>
          <h4 className={styles.h4r}>
            Candidate wards <span className={styles.k}>{candidates.offerable.length}</span>
          </h4>
          {candidates.offerable.length === 0 ? (
            <p className={styles.mute}>No other ward could take this person now.</p>
          ) : (
            <ul className={`${styles.wards} ${styles.candidates}`} aria-label="Wards that could take this person">
              {candidates.offerable.map((candidate) => (
                <li key={candidate.unitId}>
                  <span className={styles.lg}>
                    <Glyph tone={candidate.tone} />
                    <span className={styles.ell}>{candidate.name}</span>
                  </span>
                  <small>
                    {candidate.text}
                    {candidate.waitlist ? ". In catchment, waiting list for a locked bed" : ""}
                  </small>
                </li>
              ))}
            </ul>
          )}
          {candidates.unavailable.length > 0 ? (
            <>
              <button
                type="button"
                className={styles.lnk}
                aria-expanded={unavailableOpen}
                onClick={() => {
                  setUnavailableOpen((open) => !open);
                }}
                data-testid={`delays-candidates-unavailable-${movement.id}`}
              >
                {`${candidates.unavailable.length} ${candidates.unavailable.length === 1 ? "ward cannot" : "wards cannot"} take this person`}
              </button>
              {unavailableOpen ? (
                <ul className={`${styles.wards} ${styles.candidates}`} aria-label="Wards that cannot take this person">
                  {candidates.unavailable.map((ward) => (
                    <li key={ward.unitId}>
                      <span className={styles.lg}>
                        <Glyph tone="closed" />
                        <span className={styles.ell}>{ward.name}</span>
                      </span>
                      <small>{`Unavailable: ${ward.reason}`}</small>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>

        {cause === "bed_pull_expired" && pullHolder ? (
          <Link
            className={styles.inlineAction}
            href={unitHref(pullHolder.id)}
            data-testid={`delays-release-pull-${movement.id}`}
          >
            Open {pullHolder.name} to release the bed or set a new pull time limit
          </Link>
        ) : null}
        {movement.declines.length > 0 ? (
          <Link
            className={styles.inlineAction}
            href="/ward-flow"
            data-testid={`delays-override-${movement.id}`}
            onClick={() => {
              setFocusMovementId(movement.id);
            }}
          >
            Override a refusal on the coordinator screen
          </Link>
        ) : null}
      </div>
      <div className={styles.acts}>
        {escalation !== undefined ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnOff}`}
            aria-disabled="true"
            onClick={ignoreUnavailableActivation}
          >
            {`Escalated ${ago(now - escalation.at)}`}
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.btn} ${escalationGate.allowed ? styles.btnPri : styles.btnOff}`}
            {...escalationGate.buttonProps}
            onClick={() => {
              if (!escalationGate.allowed) return;
              onEscalate(movement);
            }}
            data-testid={`delays-escalate-${movement.id}`}
            title="Escalate to State bed coordination desk"
          >
            {/* Audit 11 Oct 2026: a short label beside Journey; the toast names the desk. */}
            Escalate
            <span className="sr-only"> to State bed coordination desk</span>
          </button>
        )}
        {escalation === undefined ? escalationGate.note : null}
        <Link className={styles.btn} href={movementHref(movement.id)}>
          Journey
        </Link>
      </div>
      {/* Q-12: delays with no named person are never dropped, so the note stays while a person is open. */}
      <section aria-label="Delays with no named person" className={styles.personSystem}>
        <NoStatewideDelays />
      </section>
    </section>
  );
}

function NoStatewideDelays() {
  return (
    <p className={styles.empty}>
      <Glyph tone="success" />
      <span>
        <b>No statewide delays recorded.</b> This model records delays only against a movement. Ward-wide closures and
        transport outages are not represented as patient movements yet.
      </span>
    </p>
  );
}

/** A register line: opens the person's row when they are on this board, otherwise their journey. */
function RegisterItem({
  movement,
  onBoard,
  onPick,
  testId,
  children,
}: {
  movement: Movement;
  onBoard: boolean;
  onPick: (id: string) => void;
  testId: string;
  children: ReactNode;
}) {
  if (onBoard)
    return (
      <button
        type="button"
        className={styles.brow}
        onClick={() => {
          onPick(movement.id);
        }}
        data-testid={testId}
      >
        {children}
      </button>
    );
  return (
    <Link className={styles.brow} href={movementHref(movement.id)} data-testid={testId}>
      {children}
    </Link>
  );
}

export function Registers({
  escalated,
  attention,
  closedToday,
  rows,
  now,
  units,
  service,
  isOutsideService,
  silentPressed,
  onSilent,
  onPick,
  part = "all",
}: {
  /** v10 phone: the registers and the longest quiet list each open in their own sheet. */
  part?: "all" | "registers" | "quiet";
  escalated: Movement[];
  attention: { movement: Movement; title: string | undefined }[];
  closedToday: Movement[];
  rows: BoardRow[];
  now: Instant;
  units: Unit[];
  service: string | null;
  isOutsideService: (movement: Movement) => boolean;
  silentPressed: boolean;
  onSilent: () => void;
  onPick: (id: string) => void;
}) {
  const patientOf = usePatientOf();
  const [tab, setTab] = useState<"escalated" | "attention" | "resolved" | "system">("escalated");
  const onBoard = (id: string) => rows.some((row) => row.movement.id === id);
  const tabs = [
    { id: "escalated", label: "Escalated", count: escalated.length },
    { id: "attention", label: "Attention", count: attention.length },
    { id: "resolved", label: "Resolved", count: closedToday.length },
    { id: "system", label: "System", count: 0 },
  ] as const;
  // Device audit (11 Oct 2026): the "Waiting on you" group already lists its own people beside this
  // rail, so Longest quiet names the quiet people under every other blocker instead of repeating them.
  // "Show all" still filters the table to everyone quiet, and says so.
  const allQuietRows = rows.filter((row) => row.silent);
  const quietRows = allQuietRows
    .filter((row) => row.cause !== "awaiting_coordinator")
    .sort((a, b) => b.quiet - a.quiet);
  const placedCount = closedToday.filter((movement) => movement.closure?.outcome === "arrived").length;
  const notProceededCount = closedToday.filter((movement) => movement.closure?.outcome === "did_not_proceed").length;
  const onTabKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((entry) => entry.id === tab);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(tabs[next].id);
    window.requestAnimationFrame(() => document.getElementById(`delays-tab-${tabs[next].id}`)?.focus());
  };

  return (
    <section
      className={`${styles.card} ${styles.side}`}
      aria-label="Escalations and resolved"
      data-ward-primitive="panel"
      data-wf-rail
      data-part={part === "all" ? undefined : part}
    >
      <div className={styles.sideB} hidden={part === "quiet"}>
        {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab, option or item */}
        <div className={styles.seg} role="tablist" aria-label="Registers" onKeyDown={onTabKey}>
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`delays-tab-${entry.id}`}
              aria-controls={`delays-pane-${entry.id}`}
              aria-selected={tab === entry.id}
              tabIndex={tab === entry.id ? 0 : -1}
              onClick={() => {
                setTab(entry.id);
              }}
            >
              {entry.label} <span className={styles.k}>{entry.count}</span>
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id="delays-pane-escalated"
          aria-labelledby="delays-tab-escalated"
          hidden={tab !== "escalated"}
          className={styles.regList}
        >
          {escalated.length === 0 ? (
            <p className={styles.empty}>Nobody has been escalated today.</p>
          ) : (
            escalated.map((movement) => {
              const escalation = movement.escalation;
              if (escalation === undefined) return null;
              return (
                <RegisterItem
                  key={movement.id}
                  movement={movement}
                  onBoard={onBoard(movement.id)}
                  onPick={onPick}
                  testId={`delays-escalation-item-${movement.id}`}
                >
                  <Glyph tone="info" />
                  <span className={styles.browText}>
                    <span className={styles.ell}>{patientOf(movement).formalName}</span>
                    <small className={styles.ell}>
                      {`To ${escalation.contact}, ${formatInstantWithDay(escalation.at, now)}`}
                      {isOutsideService(movement) ? (
                        <span data-testid={`delays-escalation-outside-${movement.id}`}>{` · Outside ${service}`}</span>
                      ) : null}
                    </small>
                  </span>
                  <span className={styles.num}>{ago(now - escalation.at)}</span>
                </RegisterItem>
              );
            })
          )}
        </div>
        <div
          role="tabpanel"
          id="delays-pane-attention"
          aria-labelledby="delays-tab-attention"
          hidden={tab !== "attention"}
          className={styles.regList}
        >
          {attention.length === 0 ? (
            <p className={styles.empty}>No movements requiring urgent attention right now.</p>
          ) : (
            attention.map(({ movement, title }) => (
              <RegisterItem
                key={movement.id}
                movement={movement}
                onBoard={onBoard(movement.id)}
                onPick={onPick}
                testId={`delays-attention-item-${movement.id}`}
              >
                <Glyph tone="danger" />
                <span className={styles.browText}>
                  <span className={styles.ell}>{patientOf(movement).formalName}</span>
                  <small className={styles.ell}>
                    {title ?? "Urgent"}
                    {isOutsideService(movement) ? (
                      <span
                        data-testid={`delays-attention-outside-${movement.id}`}
                      >{` \u00b7 Outside ${service}`}</span>
                    ) : null}
                  </small>
                </span>
                <span className={styles.num}>{splitDuration(Math.max(0, now - movement.openedAt))}</span>
              </RegisterItem>
            ))
          )}
        </div>
        <div
          role="tabpanel"
          id="delays-pane-resolved"
          aria-labelledby="delays-tab-resolved"
          hidden={tab !== "resolved"}
          className={styles.regList}
        >
          {closedToday.length === 0 ? (
            <p className={styles.empty}>
              {service === null
                ? "Nobody who was on this screen this morning has left it yet."
                : `Nobody who was on this screen this morning has left it yet, in ${service}.`}
            </p>
          ) : (
            <>
              <p className={styles.footNote} data-testid="delays-resolved-summary">
                {[
                  placedCount > 0
                    ? `${placedCount === 1 ? "One person" : `${placedCount} people`} who ${placedCount === 1 ? "was" : "were"} on this screen earlier ${placedCount === 1 ? "is" : "are"} now placed.`
                    : null,
                  notProceededCount > 0
                    ? `${notProceededCount === 1 ? "One person" : `${notProceededCount} people`} did not proceed.`
                    : null,
                ]
                  .filter((sentence) => sentence !== null)
                  .join(" ")}{" "}
                Kept until midnight for handover.
              </p>
              {closedToday.map((movement) => {
                const closure = movement.closure;
                if (closure === undefined) return null;
                const placed = closure.outcome === "arrived";
                const where =
                  placed && movement.acceptedUnitId !== undefined
                    ? (units.find((unit) => unit.id === movement.acceptedUnitId)?.name ?? "Placed")
                    : placed
                      ? "Placed"
                      : "Did not proceed";
                return (
                  <div key={movement.id} className={`${styles.brow} ${styles.browStatic}`}>
                    <Glyph tone={placed ? "success" : "closed"} />
                    <span className={styles.browText}>
                      <span className={styles.ell}>{patientOf(movement).formalName}</span>
                      <small className={styles.ell}>{placed ? `Placed, ${where}` : where}</small>
                    </span>
                    <span className={`${styles.num} ${styles.mute}`}>{formatInstantWithDay(closure.at, now)}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div
          role="tabpanel"
          id="delays-pane-system"
          aria-labelledby="delays-tab-system"
          hidden={tab !== "system"}
          className={styles.regList}
        >
          <section aria-label="Delays with no named person" className={styles.system} data-ward-primitive="panel">
            <NoStatewideDelays />
          </section>
        </div>
      </div>
      <div className={`${styles.sideB} ${styles.sideSplit}`} hidden={part === "registers"}>
        <div className={styles.sec}>
          <h3 className={styles.h4r}>
            Longest quiet <span className={styles.k}>{quietRows.length}</span>
          </h3>
          <p className={styles.mute}>Not waiting on you</p>
          {quietRows.length === 0 ? (
            <p className={styles.mute}>
              {rows.length === 0
                ? "Nobody is waiting."
                : allQuietRows.length > 0
                  ? "Everyone quiet is waiting on you, in the table."
                  : `Everyone has had something recorded in the last ${hoursWord(SILENT_MINUTES)}.`}
            </p>
          ) : (
            quietRows.slice(0, 7).map((row) => (
              <button
                key={row.movement.id}
                type="button"
                className={`${styles.brow} ${styles.browQuiet}`}
                onClick={() => {
                  onPick(row.movement.id);
                }}
              >
                <span className={styles.browText}>
                  <span className={styles.ell}>{patientOf(row.movement).formalName}</span>
                  <small className={styles.ell}>{causeTitle(row.cause)}</small>
                </span>
                <span className={`${styles.lg} ${styles.num} ${styles.qv}`}>
                  <Glyph tone="warning" />
                  {splitDuration(row.quiet)}
                </span>
              </button>
            ))
          )}
        </div>
        {allQuietRows.length > 0 ? (
          <button type="button" className={styles.chip} aria-pressed={silentPressed} onClick={onSilent}>
            {`Show all ${allQuietRows.length} quiet in the table`}
          </button>
        ) : null}
      </div>
    </section>
  );
}
