"use client"; // Forked from src/components/ward-redesign/waiting/delays-board-panels-redesign.tsx (role view: nurse in charge).

// The Delays board's side rail: the person's panel for the open row, and the registers it replaces
// (escalated, attention, closed today). Split out of delays-board.tsx to keep that file under the
// line cap.
//
// Role view (nurse in charge): only the person panel is forked; the registers are the coordinator's and
// the ward desk's board leaves them out.
//
// Redesign fork (Josh, 30 Oct 2026): the person panel shows the recorded form time as typed, with no
// countdown. Everything else is today's file.
import { useMemo, useState, type RefObject } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { formatInstantWithDay, type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
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
import { answerSilenceReminder, isCleared } from "@/components/ward-management/delays/delays-derivations";
import { Glyph } from "@/components/ward-management/delays/delays-board-parts";
import {
  catchmentName,
  wardLines,
  candidateWards,
  waitTone,
  type BoardRow,
} from "@/components/ward-management/delays/delays-board-model";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { movementHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import styles from "@/components/ward-management/delays/delays-board.module.css";
import { ago, originLabel } from "@/components/ward-management/delays/delays-board-rows";
import { useWardDeskWaiting } from "./ward-desk-waiting";
import { standingSuffix, typedTimeStanding } from "@/components/ward-redesign/legal-forms/typed-time-words";

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
  const { referrals, setFocusMovementId } = useWardFlowSelect("referrals", "setFocusMovementId");
  const patientOf = usePatientOf();
  const escalationGate = useRoleGate()("RECORD_ESCALATION");
  // Role view (nurse in charge): "on you" reads as the coordinator's move; the coordinator's tools (other
  // wards that could take the person, override, escalate, statewide delays) are left out (FD-23).
  const { wardDesk, causeTitle, ownerName } = useWardDeskWaiting(units);
  const { movement, cause } = row;
  const typedEnd = movement.legalForm === undefined ? undefined : currentLegalDueAt(movement);
  const thresholds = useDueSoonThresholds();
  const typedStanding = typedTimeStanding(movement, now, thresholds);
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

        {/* Redesign (point 18 and decision 1, Josh 30 Oct 2026): the recorded form time as typed, as
            Legal forms shows it. No countdown; its colour compares the typed time with the user's
            warning settings and always carries its words. */}
        {legalForm !== undefined && typedEnd !== undefined ? (
          <div className={`${styles.inset} ${styles.clock}`} data-testid={`delays-legal-clock-${movement.id}`}>
            <div className={styles.grow}>
              <b>
                {typedStanding.word ? <Glyph tone={typedStanding.tone} /> : null}
                {`${legalFormName(legalForm)} ends ${formatInstantWithDay(typedEnd, now)}`}
              </b>
              <span className={styles.mute}>
                As typed on the form{standingSuffix(typedStanding)} <LegalLimitsNotChecked variant="tag" />
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
        {wardDesk ? null : (
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
                  <ul
                    className={`${styles.wards} ${styles.candidates}`}
                    aria-label="Wards that cannot take this person"
                  >
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
        )}

        {cause === "bed_pull_expired" && pullHolder ? (
          <Link
            className={styles.inlineAction}
            href={unitHref(pullHolder.id)}
            data-testid={`delays-release-pull-${movement.id}`}
          >
            Open {pullHolder.name} to release the bed or set a new pull time limit
          </Link>
        ) : null}
        {movement.declines.length > 0 && !wardDesk ? (
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
        ) : wardDesk ? null : (
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
        {escalation === undefined && !wardDesk ? escalationGate.note : null}
        <Link className={styles.btn} href={movementHref(movement.id)}>
          Journey
        </Link>
      </div>
      {/* Q-12: delays with no named person are never dropped, so the note stays while a person is open. */}
      {wardDesk ? null : (
        <section aria-label="Delays with no named person" className={styles.personSystem}>
          <NoStatewideDelays />
        </section>
      )}
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
