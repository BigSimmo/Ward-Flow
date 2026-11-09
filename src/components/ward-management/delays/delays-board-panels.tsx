"use client";

// The Delays board's panels: the person's drawer for the open row (kit PanelDrawer, drawer review
// 6 Nov 2026), and the registers rail (escalated, attention, closed today). Split out of delays-board.tsx to keep that file under the
// line cap.
//
// Waiting redesign (round 8, approved 31 Oct 2026): Summary and Wards tabs, pinned links, and the
// recorded form time as typed, with no countdown (D-93).
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Ban, CircleCheck, Flag, MoonStar, ChevronRight, Stethoscope, TriangleAlert } from "lucide-react";
import { DrawerFootRow, PanelDrawer, ShowMoreRow, buttonClass } from "@/components/wf";
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
import { answerSilenceReminder, isCleared } from "./delays-derivations";
import { Glyph } from "./delays-board-parts";
import { useWaitingDeskWords } from "./waiting-desk-words";
import {
  SILENT_MINUTES,
  hoursWord,
  catchmentName,
  wardLines,
  candidateWards,
  waitTone,
  type BoardRow,
} from "./delays-board-model";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { edHref, movementHref, unitHref } from "@/components/ward-management/shell/ward-facade";
import styles from "./delays-board.module.css";
import { RowTimeline, ago, originLabel } from "./delays-board-rows";
import { CoordinatorFootMenu, EdBoardFootPeek, MovementRecordLink } from "./delays-board-foot";
import { standingSuffix, typedTimeStanding } from "@/components/ward-management/legal-forms/legal-forms-view";
import { typedTimePhrase } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import redesign from "./waiting.module.css";
import polish from "./waiting-polish.module.css";
import {
  escalationByLabel,
  escalationHistory,
  escalationNextLabel,
  escalationRecords,
} from "@/components/ward-management/movements/escalation-history";

/** Round 7: candidate wards shown before Show more. */
const CANDIDATE_LIMIT = 5;

export function PersonPanel({
  row,
  units,
  now,
  onClose,
  onEscalate,
  initialTab,
}: {
  row: BoardRow;
  units: Unit[];
  now: Instant;
  onClose: () => void;
  onEscalate: (movement: Movement) => void;
  /** Note 8, issue 4: the tab a person opens on when another part of the page asks (default Summary). */
  initialTab?: "summary" | "wards";
}) {
  const { referrals, setFocusMovementId } = useWardFlowSelect("referrals", "setFocusMovementId");
  const patientOf = usePatientOf();
  const escalationGate = useRoleGate()("RECORD_ESCALATION");
  // Role views (`waiting-desk-words.ts`): "on you" is said from the desk's side. A ward desk does not
  // get the coordinator's tools (other wards that could take the person, override, escalate,
  // statewide delays; FD-23).
  const desk = useWaitingDeskWords(units);
  const { wardDesk } = desk;
  // DA-09: a link this desk cannot open is not offered (the ED desk has no coordinator screen, the
  // ward desk no ED board), so none leads to "Not part of your role".
  const canOpen = useCanOpenHref();
  const { movement, cause } = row;
  const typedEnd = movement.legalForm === undefined ? undefined : currentLegalDueAt(movement);
  const thresholds = useDueSoonThresholds();
  const typedStanding = typedTimeStanding(movement, now, thresholds);
  const patient = patientOf(movement);
  // Item 28: the latest escalation and those before it, each with what happened next (derived),
  // all read from one list so the two never disagree.
  const escalations = escalationHistory(movement);
  const escalation = escalations.at(-1);
  const earlierEscalations = escalations.slice(0, -1);
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
  // Round 7 (Josh, 31 Oct 2026): the candidate list shows its first five, then Show more, in place
  // of a small box that scrolled inside the panel.
  const [allCandidates, setAllCandidates] = useState(false);
  // Round 8 (Josh, 31 Oct 2026): "a lot of information". The panel opens on Summary; the ward
  // lists sit behind a Wards tab. A new person always opens on Summary.
  const [tabState, setTabState] = useState<{ id: string; tab: "summary" | "wards" }>({
    id: movement.id,
    tab: initialTab ?? "summary",
  });
  const panelTab = tabState.id === movement.id ? tabState.tab : (initialTab ?? "summary");
  const setPanelTab = (tab: "summary" | "wards") => setTabState({ id: movement.id, tab });
  // v10 phone: a journey bar from arrival to now leads the person sheet.
  const isPhonePanel = useIsPhone();
  const pullHolder = units.find((unit) => unit.id === movement.acceptedUnitId);
  const legalForm = movement.legalForm;

  // Drawer review (6 Nov 2026): one filled primary in the drawer foot. Escalate leads; once escalated
  // the foot says when, greyed. A ward desk does not escalate (FD-23), so its foot is the links alone.
  const primary =
    escalation !== undefined ? (
      <button
        type="button"
        className={buttonClass({ variant: "sec", size: "md" })}
        aria-disabled="true"
        onClick={ignoreUnavailableActivation}
      >
        {`Escalated ${ago(now - escalation.at)}`}
      </button>
    ) : wardDesk ? null : (
      <button
        type="button"
        className={buttonClass({ variant: escalationGate.allowed ? "pri" : "sec", size: "md" })}
        {...escalationGate.buttonProps}
        onClick={() => {
          if (!escalationGate.allowed) return;
          onEscalate(movement);
        }}
        data-testid={`delays-escalate-${movement.id}`}
        title="Escalate to State bed coordination desk"
      >
        {/* Audit 11 Oct 2026: a short label; the toast names the desk. */}
        Escalate
        <span className="sr-only"> to State bed coordination desk</span>
      </button>
    );
  const wardsCount = wardDesk
    ? movement.declines.length === 0
      ? undefined
      : `${movement.declines.length} declined`
    : movement.declines.length > 0
      ? `${movement.declines.length} declined · ${candidates.offerable.length} to ask`
      : `${candidates.offerable.length} to ask`;

  // Drawer review (6 Nov 2026): the person opens in the kit drawer at every width, as Transport, Out
  // of area and Referrals do, so the list keeps the full width and the page's one scroll. Head: the
  // name, one line (UMRN, from, catchment) and the tier tag, then Summary and Wards as kit tabs. Body:
  // the one scroll, with the row's timeline in Summary. Foot: Escalate, then Movement, Coordinator and
  // ED board as equal quiet buttons.
  return (
    <PanelDrawer
      open
      onClose={onClose}
      title={patient.formalName}
      subtitle={
        <span data-testid="delays-panel-sub">
          <span className={styles.num}>{patient.umrn}</span>
          {[originLabel(movement), catchmentName(row.origin)]
            .filter(Boolean)
            .map((part) => ` · ${part}`)
            .join("")}
        </span>
      }
      tag={
        <span className={polish.pTier}>
          <TierTile tier={movement.urgency} label={urgencyTierLabel(movement.urgency)} />
        </span>
      }
      closeLabel="Close why this person is waiting"
      tabs={[
        { id: "summary" as const, label: "Summary" },
        { id: "wards" as const, label: "Wards", count: wardsCount },
      ]}
      tab={panelTab}
      onTabChange={setPanelTab}
      tabsLabel="Person details"
      bodyLabel="Why this person is waiting"
      testId={`delays-detail-${movement.id}`}
      foot={
        <>
          {primary ? <div className={polish.pPrimary}>{primary}</div> : null}
          {escalation === undefined && !wardDesk ? escalationGate.note : null}
          <DrawerFootRow className={polish.pFootRow}>
            <MovementRecordLink movement={movement} />
            {/* Role views: the coordinator screen is the coordinator's tool. Note 8: its actions open here first. */}
            {wardDesk || !canOpen("/ward-flow") ? null : (
              <CoordinatorFootMenu
                movement={movement}
                onShowWards={() => setPanelTab("wards")}
                onOpenHome={() => setFocusMovementId(movement.id)}
              />
            )}
            {movement.originEdId && canOpen(edHref(movement.originEdId)) ? (
              <EdBoardFootPeek movement={movement} now={now} />
            ) : null}
            {/* No "Record" link here: archived D-14 keeps the patient link default-deny, and this panel is not on
                its allowlist. "Movement" opens the movement, whose drawer names the person (O-16.3). */}
          </DrawerFootRow>
        </>
      }
    >
      <div className={`${styles.sideB} ${polish.pBody}`}>
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
        <div className={`${styles.inset} ${styles.causeInset} ${polish.pCause}`}>
          <div className={styles.grow}>
            <b className={redesign.wrapTitle}>{desk.causeTitle(cause)}</b>
            <span className={polish.ownerTag} data-owner={desk.tagOwner(row.owner)}>
              {desk.moveWord(row.owner)}
            </span>
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
            <Glyph tone="warning" /> Pull expired, bed still pulled. Release the bed or set a new pull time limit.
          </p>
        ) : null}
        {silenceReminder !== undefined ? (
          <p className={styles.reminder} data-testid={`delays-silence-reminder-${movement.id}`}>
            <Glyph tone="warning" /> {silenceReminder}
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
                {`${legalFormName(legalForm)} ${typedTimePhrase(typedEnd, now).replace(/ as typed$/, "")}`}
              </b>
              <span className={styles.mute}>
                As typed on the form{standingSuffix(typedStanding)} <LegalLimitsNotChecked variant="tag" />
              </span>
            </div>
          </div>
        ) : null}

        {/* Round 8: three lines. "From" is already in the header; bed and legal status share one. */}
        <dl className={`${styles.facts} ${polish.pFacts}`}>
          <dt>Last update</dt>
          <dd>
            <Glyph tone={row.silent ? "warning" : undefined} />
            {row.activity === undefined ? "Nothing recorded since arrival" : `${ago(row.quiet)}, ${row.activity.what}`}
          </dd>
          <dt>Needs</dt>
          <dd>{`${row.locked ? "A locked bed" : "An open bed"} · ${movement.legalStatus}`}</dd>
          <dt>Stage</dt>
          <dd data-testid="delays-panel-stage">{`${stageCopy[movement.stage].label} · held by ${movement.owner}`}</dd>
        </dl>

        {panelTab === "summary" ? (
          <>
            <div className={polish.pNotes}>
              {activeBlocker ? (
                <p className={`${styles.note} ${polish.pNote}`} data-testid="delays-blocker">
                  <Ban size={14} aria-hidden="true" className={polish.pNoteIcon} />
                  <span>
                    <strong>Blocked:</strong> {blockerText}
                  </span>
                </p>
              ) : null}
              {escalation !== undefined ? (
                <p className={`${styles.note} ${polish.pNote}`} data-testid="delays-escalation">
                  <Flag size={14} aria-hidden="true" className={polish.pNoteIcon} />
                  <span>
                    <strong>Escalated {ago(now - escalation.at)}</strong>
                    {` (${formatInstantWithDay(escalation.at, now)}) to ${escalation.contact}`}
                    {/* The three escalation facts stay on the note: when, who to, and which wards were
                    tried, by name, since a ward tried but never asked is named nowhere else. */}
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
                    {earlierEscalations.length > 0 ? (
                      <span data-testid="delays-escalation-history">
                        {" · Earlier: "}
                        {earlierEscalations
                          .map(
                            (entry) =>
                              `${formatInstantWithDay(entry.at, now)} to ${entry.contact} by ${escalationByLabel(entry)}, then ${escalationNextLabel(
                                entry.next,
                                (unitId) => units.find((unit) => unit.id === unitId)?.name ?? "a ward",
                                (at) => formatInstantWithDay(at, now),
                              ).replace(/^\w/u, (first) => first.toLowerCase())}`,
                          )
                          .join("; ")}
                      </span>
                    ) : null}
                  </span>
                </p>
              ) : null}

              <p
                className={`${styles.note} ${polish.pNote} ${cleared === false ? styles.noteWarn : ""}`}
                data-testid={`delays-clearance-${movement.id}`}
              >
                <Stethoscope size={14} aria-hidden="true" className={polish.pNoteIcon} />
                <span>
                  <strong>
                    {cleared === undefined ? "Not assessed" : cleared ? "Medically cleared" : "Not medically cleared"}
                  </strong>{" "}
                  {cleared === undefined
                    ? "Nobody has recorded whether this person is fit to travel."
                    : cleared
                      ? "Cleared to travel."
                      : "A bed becoming free does not release this person."}
                </span>
              </p>
            </div>

            {/* Drawer review (6 Nov 2026): the row's timeline moved here from under the table row. */}
            <section className={polish.pTimeline} aria-label="Timeline">
              <h4 className={styles.h4r}>Timeline</h4>
              <RowTimeline row={row} units={units} now={now} />
            </section>
            {/* Q-12: delays with no named person are never dropped, so the note stays while a person is open. */}
            {wardDesk ? null : (
              <section aria-label="Delays with no named person" className={`${styles.personSystem} ${polish.pFoot}`}>
                <NoStatewideDelays />
              </section>
            )}
          </>
        ) : (
          <div className={polish.pWardsPane}>
            <div className={`${styles.sec} ${polish.pSec}`}>
              <h4 className={styles.h4r}>
                Asked
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
              <div className={`${styles.sec} ${polish.pSec}`} data-testid={`delays-candidates-${movement.id}`}>
                <h4 className={styles.h4r}>
                  Candidate wards <span className={styles.k}>{candidates.offerable.length}</span>
                </h4>
                {candidates.offerable.length === 0 ? (
                  <p className={styles.mute}>No other ward could take this person now.</p>
                ) : (
                  <ul className={`${styles.wards} ${polish.pWards}`} aria-label="Wards that could take this person">
                    {(allCandidates ? candidates.offerable : candidates.offerable.slice(0, CANDIDATE_LIMIT)).map(
                      (candidate) => (
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
                      ),
                    )}
                  </ul>
                )}
                {candidates.offerable.length > CANDIDATE_LIMIT ? (
                  <ShowMoreRow onClick={() => setAllCandidates((current) => !current)} expanded={allCandidates}>
                    {allCandidates ? "Show fewer" : `Show ${candidates.offerable.length - CANDIDATE_LIMIT} more`}
                  </ShowMoreRow>
                ) : null}
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
                        className={`${styles.wards} ${polish.pWards}`}
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
            {movement.declines.length > 0 && !wardDesk && canOpen("/ward-flow") ? (
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
        )}
      </div>
    </PanelDrawer>
  );
}

function NoStatewideDelays() {
  // Role view (as ED clinician): an ED desk reads its own department, so "statewide" is dropped.
  const { edDesk } = useWaitingDeskWords();
  return (
    <p className={styles.empty}>
      <Glyph tone="success" />
      <span>
        <b>{edDesk ? "No delays recorded." : "No statewide delays recorded."}</b> Only delays on a movement are counted;
        ward closures and transport outages are not.
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
        <ChevronRight size={15} aria-hidden="true" className={polish.regGo} />
      </button>
    );
  return (
    <Link className={styles.brow} href={movementHref(movement.id)} data-testid={testId}>
      {children}
      <ChevronRight size={15} aria-hidden="true" className={polish.regGo} />
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
  titled = true,
}: {
  /** v10 phone: the registers and the longest quiet list each open in their own sheet. */
  part?: "all" | "registers" | "quiet";
  /** Design brief (Josh, 3 Nov 2026): a sheet that already names "Today's follow-up" drops the inner title. */
  titled?: boolean;
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
  // Role views (`waiting-desk-words.ts`): "on you" is said from the desk's side.
  const desk = useWaitingDeskWords();
  // Diagnosed issues W3 (Josh, 3 Nov 2026): "Today's follow-up" opens on whatever needs acting on
  // first: the urgent list when it has anyone, else today's escalations.
  const [tab, setTab] = useState<"escalated" | "attention" | "resolved">(
    attention.length > 0 ? "attention" : "escalated",
  );
  const onBoard = (id: string) => rows.some((row) => row.movement.id === id);
  // Round 4 (Josh, 31 Oct 2026): four register tabs, each an icon, its count and its name in one
  // column, so the choice reads at a glance; the open one is lifted with its colour underneath.
  const tabs = [
    {
      id: "attention",
      // Q-12 (owner ruling): the "Attention" tab is never dropped or renamed.
      label: "Attention",
      count: attention.length,
      tone: "danger",
      Icon: TriangleAlert,
      note: "Form due soon or no suitable bed. Open a person to act.",
    },
    {
      id: "escalated",
      label: "Escalated",
      count: escalated.length,
      tone: "info",
      Icon: Flag,
      note: "Raised to another desk today. Open to see the reply.",
    },
    {
      id: "resolved",
      label: "Done today",
      count: closedToday.length,
      tone: "success",
      Icon: CircleCheck,
      note: "Placed or not proceeding today.",
    },
  ] as const;
  // Device audit (11 Oct 2026): the "Waiting on you" group already lists its own people beside this
  // rail, so Longest quiet names the quiet people under every other blocker instead of repeating them.
  // "Show all" still filters the table to everyone quiet, and says so.
  const allQuietRows = rows.filter((row) => row.silent);
  // Note 8, issue 3: nor does it repeat anyone already listed under Attention.
  const attentionIds = new Set(attention.map(({ movement }) => movement.id));
  const quietRows = allQuietRows
    .filter((row) => row.cause !== "awaiting_coordinator" && !attentionIds.has(row.movement.id))
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
      // Drawer review (6 Nov 2026): no `data-wf-rail`. The registers grow with the page, so the
      // page keeps one scroll; the person opens in the drawer, not in this column.
      data-part={part === "all" ? undefined : part}
    >
      <div className={`${styles.sideB} ${polish.regBody}`} hidden={part === "quiet"}>
        {titled ? <h3 className={polish.regTitle}>Today&apos;s follow-up</h3> : null}
        {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab, option or item */}
        <div className={polish.regTabs} role="tablist" aria-label="Today's follow-up" onKeyDown={onTabKey}>
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`delays-tab-${entry.id}`}
              aria-controls={`delays-pane-${entry.id}`}
              aria-selected={tab === entry.id}
              tabIndex={tab === entry.id ? 0 : -1}
              className={polish.regTab}
              data-tone={entry.tone}
              data-empty={entry.count === 0 || undefined}
              onClick={() => {
                setTab(entry.id);
              }}
            >
              <span className={polish.regTabTop}>
                <entry.Icon size={15} aria-hidden="true" className={polish.regTabIcon} />
                <span className={`${polish.regTabCount} ${styles.num}`}>{entry.count}</span>
              </span>
              <span className={polish.regTabLabel}>{entry.label}</span>
            </button>
          ))}
        </div>
        {/* Note 8, issue 3 (Josh, 8 Nov 2026): the tab's one-line note is read out, not shown, so the
            rail opens straight on the people. */}
        <p className="sr-only">{tabs.find((entry) => entry.id === tab)?.note}</p>
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
                      {escalationRecords(movement).length > 1
                        ? ` · escalated ${escalationRecords(movement).length} times`
                        : null}
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
              {service === null ? "Nobody resolved yet today." : `Nobody resolved yet today in ${service}.`}
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
      </div>
      <div className={`${styles.sideB} ${styles.sideSplit} ${polish.regBody}`} hidden={part === "registers"}>
        <div className={styles.sec}>
          <h3 className={`${styles.h4r} ${polish.quietTitle}`}>
            <MoonStar size={15} aria-hidden="true" />
            Longest quiet <span className={styles.k}>{quietRows.length}</span>
          </h3>
          <p className={styles.mute}>{desk.notOnYou}</p>
          {quietRows.length === 0 ? (
            <p className={styles.mute}>
              {rows.length === 0
                ? "Nobody is waiting."
                : allQuietRows.length > 0
                  ? `Everyone quiet is ${desk.quietOnYou}, in the table.`
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
                  <small className={styles.ell}>{desk.causeTitle(row.cause)}</small>
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
      {/* W3: the old System tab was nearly always 0. Note 8, issue 3: it is the card's quiet foot line. */}
      {part === "quiet" ? null : (
        <section aria-label="Delays with no named person" className={polish.regSystem}>
          <NoStatewideDelays />
        </section>
      )}
    </section>
  );
}
