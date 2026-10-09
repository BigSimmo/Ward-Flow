"use client";

/**
 * The Delays board, built from the approved Delays page mockup (October 2026): hero counts that
 * filter, four "whose move" tiles, the waiting table grouped by blocker with a timeline under the
 * open row, a registers rail that becomes the person's panel, and three graphs under the table.
 *
 * Every figure is read from the engine (`delays-board-model.ts`). Selecting, filtering and the
 * graphs are presentation state only; the one write is Escalate, which the screen dispatches.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { ChevronDown, Search, X } from "lucide-react";

import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { stageCopy } from "@/components/ward-management/ward-derivations";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  type Movement,
  type Unit,
} from "@/components/ward-management/ward-model";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { edById } from "@/components/ward-management/ward-sites";
import { departmentLabel } from "@/components/ward-management/ward-absence-labels";
import { currentDueSoonThresholds } from "@/components/ward-management/ward-clock";
import { Hero, TierTile, type WfTone } from "@/components/wf";
import { answerSilenceReminder, isCleared, type DelayCause, type DelayGroup } from "./delays-derivations";
import { BandBar, Glyph, causeTitle } from "./delays-board-parts";
import {
  NO_FILTERS,
  OVER_24H,
  OVER_8H,
  SILENT_MINUTES,
  H24,
  H8,
  hoursWord,
  WAIT_THRESHOLDS,
  WAIT_THRESHOLD_LABELS,
  bandCounts,
  boardCatchments,
  boardRows,
  catchmentName,
  dueTone,
  filterRows,
  hasFilters,
  rowMatchesFilters,
  isBreached,
  isDueSoon,
  isPinned,
  ownerName,
  ownerTiles,
  rowEvents,
  runwayBins,
  wardLines,
  wardSummary,
  waitTone,
  type BoardFilters,
  type BoardRow,
  type WaitThreshold,
} from "./delays-board-model";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { DelaysBoardGraphs } from "./delays-board-graphs";
import styles from "./delays-board.module.css";

/** Groups shown open on first load: the severe ones and "Waiting on you". The rest start folded. */
const OPEN_BY_DEFAULT: readonly DelayCause[] = [
  "legal_breached",
  "legal_expiring",
  "no_eligible_bed",
  "awaiting_coordinator",
];
const GROUP_LIMIT = 5;

export type DelaysBoardProps = {
  groups: DelayGroup[];
  now: Instant;
  units: Unit[];
  /** Whole-network escalations. A row outside the chosen service is marked, never dropped. */
  escalated: Movement[];
  /** Q-12: the severe causes network-wide, plus urgent movements outside the chosen service. */
  attention: { movement: Movement; title: string | undefined }[];
  closedToday: Movement[];
  service: string | null;
  isOutsideService: (movement: Movement) => boolean;
  onEscalate: (movement: Movement) => void;
  onNotWired: () => void;
  /** Rendered under the hero: the alias banner, the service scope bar and any notice. */
  banner?: ReactNode;
  /** Shown in place of the board's body when nobody is waiting. */
  empty?: ReactNode;
};

/** The origin department by name, or a sentence that names the record as the fault (task D1). */
function originLabel(movement: Movement): string {
  return edById(movement.originEdId)?.name ?? `This movement names ${departmentLabel(movement.originEdId, undefined)}`;
}

/** Below 64rem the person's panel is a sheet over the table (see delays-board.module.css). */
const SHEET_QUERY = "(max-width: 64rem)";

function isSheetLayout(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(SHEET_QUERY).matches;
}

function subscribeSheetLayout(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(SHEET_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True at or below 64rem, where the person's panel is a sheet over the table. */
function useSheetLayout(): boolean {
  return useSyncExternalStore(subscribeSheetLayout, isSheetLayout, () => false);
}

function ago(minutes: number): string {
  return minutes < 1 ? "just now" : `${splitDuration(minutes)} ago`;
}

function legalCell(row: BoardRow): ReactNode {
  const form = row.movement.legalForm;
  if (row.dueIn === undefined || form === undefined) return row.movement.legalStatus;
  const tone = row.dueIn < 0 ? "danger" : dueTone(row.dueIn);
  const left = row.dueIn < 0 ? `${splitDuration(-row.dueIn)} overdue` : `${splitDuration(row.dueIn)} left`;
  return (
    <span className={styles.lg}>
      <Glyph tone={tone} />
      <span className={styles.ell}>{`Form ${form.code}, ${left}`}</span>
    </span>
  );
}

function updateCell(row: BoardRow, now: Instant): ReactNode {
  const escalation = row.movement.escalation;
  if (escalation !== undefined)
    return (
      <span className={styles.lg}>
        <Glyph tone="info" />
        {`Escalated ${splitDuration(Math.max(0, now - escalation.at))}`}
      </span>
    );
  if (row.activity === undefined)
    return (
      <span className={styles.lg}>
        <Glyph tone="warning" />
        No update
      </span>
    );
  return (
    <span className={styles.lg}>
      <Glyph tone={row.silent ? "warning" : undefined} />
      {ago(row.quiet)}
    </span>
  );
}

/** Active time solid, quiet time hatched (amber once quiet 2h or more), on a 24 hour scale. */
function WaitBar({ row }: { row: BoardRow }) {
  const total = Math.min(row.waited, OVER_24H);
  const quiet = Math.min(row.quiet, total);
  const pct = (minutes: number) => `${((minutes / OVER_24H) * 100).toFixed(2)}%`;
  return (
    <span className={styles.wbw}>
      <span
        className={styles.wbar}
        role="img"
        aria-label={`Waited ${splitDuration(row.waited)}, nothing recorded for ${splitDuration(row.quiet)}`}
      >
        <span className={styles.wbAct} style={{ width: pct(total - quiet) }} />
        <span
          className={`${styles.wbQ} ${row.silent ? styles.quietLong : styles.quietShort}`}
          style={{ left: pct(total - quiet), width: pct(quiet) }}
        />
        <span className={styles.wb8} style={{ left: pct(OVER_8H) }} />
      </span>
      {row.waited > OVER_24H ? (
        <span className={styles.wbOver} aria-hidden="true">
          {"›"}
        </span>
      ) : null}
    </span>
  );
}

/** The open row's own journey: arrival to now, then the recorded legal time if there is one. */
function RowTimeline({ row, units, now }: { row: BoardRow; units: Unit[]; now: Instant }) {
  const all = rowEvents(row, units, now);
  const keep = all.length <= 3 ? all : [all[0], ...all.slice(-2)];
  const due = row.dueIn;
  const dueAhead = due !== undefined && due >= 0 ? due : undefined;
  const capped = dueAhead !== undefined && dueAhead > row.waited * 0.6;
  const total = Math.max(
    1,
    due === undefined ? row.waited : due < 0 ? row.waited - due : capped ? row.waited * 1.32 : row.waited + dueAhead!,
  );
  const at = (minutes: number) => Math.min(100, (minutes / total) * 100);
  const nowP = at(row.waited);
  const lastP = at(row.waited - row.quiet);
  const dueP = due === undefined ? null : capped ? 100 : at(row.waited + due);
  const opened = row.movement.openedAt;
  const labels: { p: number; time: string; text: string; tone?: WfTone }[] = keep.map((event) => ({
    p: at(event.offset),
    time: formatInstantWithDay(opened + event.offset, now),
    text: event.what,
  }));
  labels.push({
    p: nowP,
    time: "Now",
    text: row.activity === undefined ? "Nothing since arrival" : `Quiet ${splitDuration(row.quiet)}`,
    tone: row.silent ? "warning" : undefined,
  });
  if (due !== undefined && dueP !== null && row.movement.legalForm)
    labels.push({
      p: dueP,
      time: formatInstantWithDay(now + due, now),
      text:
        due < 0
          ? `Form ${row.movement.legalForm.code} overdue, ${splitDuration(-due)} past deadline`
          : `Form ${row.movement.legalForm.code} due, ${splitDuration(due)} left`,
      tone: due < 0 ? "danger" : dueTone(due) ?? "warning",
    });
  // A recorded legal time that has already passed stays on the journey, marked where it fell.
  const passed = row.dueIn !== undefined && row.dueIn < 0 && row.movement.legalForm ? -row.dueIn : undefined;
  const passedP = passed === undefined ? null : at(Math.max(0, row.waited - passed));
  if (passed !== undefined && passedP !== null && row.movement.legalForm)
    labels.push({
      p: passedP,
      time: formatInstantWithDay(now - passed, now),
      text: `Form ${row.movement.legalForm.code} time passed, ${splitDuration(passed)} ago`,
      tone: "danger",
    });
  labels.sort((a, b) => a.p - b.p);
  // Keep labels apart: each needs about 18% of the width.
  const width = 18;
  const pos = labels.map((label) => label.p);
  for (let i = 0; i < pos.length; i += 1) {
    pos[i] = Math.max(pos[i], width / 2);
    if (i > 0) pos[i] = Math.max(pos[i], pos[i - 1] + width);
  }
  pos[pos.length - 1] = Math.min(pos[pos.length - 1], 100 - width / 2);
  for (let i = pos.length - 2; i >= 0; i -= 1) pos[i] = Math.min(pos[i], pos[i + 1] - width);

  return (
    <div className={styles.sx} data-testid={`delays-row-timeline-${row.movement.id}`}>
      <div className={styles.sxPlot} aria-hidden="true">
        <span className={styles.sxTrack}>
          <span className={styles.sxAct} style={{ width: `${lastP}%` }} />
          <span
            className={`${styles.sxQ} ${row.silent ? styles.quietLong : styles.quietShort}`}
            style={{ left: `${lastP}%`, width: `${nowP - lastP}%` }}
          />
        </span>
        {keep.map((event) => (
          <span
            key={`${event.offset}-${event.what}`}
            className={`${styles.sxEv} ${styles[`ev_${event.tone}`]}`}
            style={{ left: `${at(event.offset)}%` }}
          />
        ))}
        <span className={styles.sxNow} style={{ left: `${nowP}%` }} />
        {dueP !== null ? (
          <>
            <span className={styles.sxAhead} style={{ left: `${nowP}%`, width: `${dueP - nowP}%` }} />
            <span
              className={`${styles.sxDue} ${dueTone(due) === "danger" ? styles.sxDueHot : ""}`}
              style={{ left: `${dueP}%` }}
            />
          </>
        ) : null}
        {passedP !== null ? (
          <span className={`${styles.sxDue} ${styles.sxDueHot}`} style={{ left: `${passedP}%` }} />
        ) : null}
      </div>
      <ol className={styles.sxLabs} aria-label="This person's recorded journey">
        {labels.map((label, index) => (
          <li key={`${label.time}-${label.text}`} className={styles.sxL} style={{ left: `${pos[index]}%` }}>
            <b className={styles.num}>
              <Glyph tone={label.tone} />
              {label.time}
            </b>
            <span>{label.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PersonPanel({
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
  const { referrals, setFocusMovementId } = useWardFlow();
  const patientOf = usePatientOf();
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
  const pullHolder = units.find((unit) => unit.id === movement.acceptedUnitId);
  const legalForm = movement.legalForm;

  return (
    <section
      className={`${styles.card} ${styles.side}`}
      aria-label="Why this person is waiting"
      data-ward-primitive="panel"
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
            Reserved time has passed, bed still held. Release the bed or set a new reserved time.
          </p>
        ) : null}
        {silenceReminder !== undefined ? (
          <p className={styles.reminder} data-testid={`delays-silence-reminder-${movement.id}`}>
            {silenceReminder}
          </p>
        ) : null}

        {legalForm !== undefined && row.dueIn !== undefined ? (
          <div className={`${styles.inset} ${styles.clock}`} data-testid={`delays-legal-clock-${movement.id}`}>
            <Glyph tone={row.dueIn < 0 ? "danger" : (dueTone(row.dueIn) ?? "warning")} />
            <div className={styles.grow}>
              <b>
                {row.dueIn < 0
                  ? `${legalFormName(legalForm)} passed its deadline ${splitDuration(-row.dueIn)} ago`
                  : `${legalFormName(legalForm)} due in ${splitDuration(row.dueIn)}`}
              </b>
              <span className={styles.mute}>
                Recorded time <LegalLimitsNotChecked variant="tag" />
              </span>
            </div>
            <span className={styles.big}>
              {row.dueIn < 0 ? `${splitDuration(-row.dueIn)} overdue` : `${splitDuration(row.dueIn)} left`}
            </span>
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

        {cause === "bed_pull_expired" && pullHolder ? (
          <Link
            className={styles.inlineAction}
            href={unitHref(pullHolder.id)}
            data-testid={`delays-release-pull-${movement.id}`}
          >
            Open {pullHolder.name} to release the bed or set a new reserved time
          </Link>
        ) : null}
        {movement.declines.length > 0 ? (
          <Link
            className={styles.inlineAction}
            href="/mockups/ward-flow"
            data-testid={`delays-override-${movement.id}`}
            onClick={() => setFocusMovementId(movement.id)}
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
            className={`${styles.btn} ${styles.btnPri}`}
            onClick={() => onEscalate(movement)}
            data-testid={`delays-escalate-${movement.id}`}
          >
            Escalate to State bed coordination desk
          </button>
        )}
        <Link className={styles.btn} href={`/mockups/ward-flow/movements/${movement.id}`}>
          Journey
        </Link>
      </div>
    </section>
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
      <button type="button" className={styles.brow} onClick={() => onPick(movement.id)} data-testid={testId}>
        {children}
      </button>
    );
  return (
    <Link className={styles.brow} href={`/mockups/ward-flow/movements/${movement.id}`} data-testid={testId}>
      {children}
    </Link>
  );
}

function Registers({
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
  onNotWired,
}: {
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
  onNotWired: () => void;
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
  const quietRows = rows.filter((row) => row.silent).sort((a, b) => b.quiet - a.quiet);
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
    >
      <div className={styles.sideB}>
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
              onClick={() => setTab(entry.id)}
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
            <p className={styles.empty}>
              <Glyph tone="success" />
              <span>
                <b>No statewide delays recorded.</b> This model records delays only against a movement. Ward-wide
                closures and transport outages are not represented as patient movements yet.
              </span>
            </p>
            <button
              type="button"
              className={styles.chip}
              onClick={onNotWired}
              aria-label="Record a service-wide or facility delay. Not wired in this prototype."
              title="Not wired in this prototype."
            >
              Record hold
            </button>
          </section>
        </div>
      </div>
      <div className={`${styles.sideB} ${styles.sideSplit}`}>
        <div className={styles.sec}>
          <h4 className={styles.h4r}>
            Longest quiet <span className={styles.k}>{quietRows.length}</span>
          </h4>
          {quietRows.length === 0 ? (
            <p className={styles.mute}>
              {rows.length === 0
                ? "Nobody is waiting."
                : `Everyone has had something recorded in the last ${hoursWord(SILENT_MINUTES)}.`}
            </p>
          ) : (
            quietRows.slice(0, 7).map((row) => (
              <button
                key={row.movement.id}
                type="button"
                className={`${styles.brow} ${styles.browQuiet}`}
                onClick={() => onPick(row.movement.id)}
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
        {quietRows.length > 0 ? (
          <button type="button" className={styles.chip} aria-pressed={silentPressed} onClick={onSilent}>
            {`Show all ${quietRows.length} in the table`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function DelaysBoard({
  groups,
  now,
  units,
  escalated,
  attention,
  closedToday,
  service,
  isOutsideService,
  onEscalate,
  onNotWired,
  banner,
  empty,
}: DelaysBoardProps) {
  const patientOf = usePatientOf();
  const rows = useMemo(() => boardRows(groups, now), [groups, now]);
  const bins = useMemo(() => runwayBins(rows), [rows]);
  const [chosenFilters, setFilters] = useState<BoardFilters>(NO_FILTERS);
  // A blocker filter whose group has emptied (the person was recategorised) stops applying, so no
  // chip names a cause the board no longer shows.
  const filters =
    chosenFilters.cause !== null && !rows.some((row) => row.cause === chosenFilters.cause)
      ? { ...chosenFilters, cause: null }
      : chosenFilters;
  // Clear a stored blocker filter once it stops applying, so a later change cannot bring it back.
  // Adjusting state during render is React's pattern for state derived from changed props.
  if (chosenFilters.cause !== null && !rows.some((row) => row.cause === chosenFilters.cause))
    setFilters((current) => ({ ...current, cause: null }));
  const [flat, setFlat] = useState(false);
  const [openGroups, setOpenGroups] = useState<Partial<Record<DelayCause, boolean>>>({});
  const [moreGroups, setMoreGroups] = useState<Partial<Record<DelayCause, boolean>>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tableRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const sheet = useSheetLayout();

  const nameOf = useCallback(
    (movement: Movement) => `${patientOf(movement).formalName} ${patientOf(movement).umrn}`,
    [patientOf],
  );
  const matchesRow = useCallback(
    (row: BoardRow) => rowMatchesFilters(row, filters, bins, nameOf),
    [filters, bins, nameOf],
  );
  const matching = useMemo(() => filterRows(rows, filters, bins, nameOf), [rows, filters, bins, nameOf]);
  const highlightActive = hasFilters(filters);
  const selected = selectedId === null ? null : (rows.find((row) => row.movement.id === selectedId) ?? null);
  const filtered = highlightActive;

  const set = (patch: Partial<BoardFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const toggle = <K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: current[key] === value ? NO_FILTERS[key] : value }));
  const isOpenGroup = (cause: DelayCause) => openGroups[cause] ?? OPEN_BY_DEFAULT.includes(cause);

  // On a phone or tablet the person's panel is a sheet, so an explicit row choice brings it into view.
  const explicitSelect = useRef(false);
  const select = (id: string) => {
    explicitSelect.current = selectedId !== id;
    setSelectedId((current) => (current === id ? null : id));
  };
  useEffect(() => {
    if (!explicitSelect.current || selectedId === null) return;
    explicitSelect.current = false;
    if (!sheet) return;
    // Focus is the shared modal lifecycle's job (useWardModalFocus below); this only scrolls.
    window.requestAnimationFrame(() => {
      document.getElementById("delays-person-panel")?.scrollIntoView?.({ block: "start" });
    });
  }, [selectedId, sheet]);
  const close = useCallback(() => {
    const previous = selectedId;
    setSelectedId(null);
    if (previous !== null)
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLButtonElement>(`[data-testid="delays-select-${previous}"]`)?.focus(),
      );
  }, [selectedId]);
  /** From a graph or the rail: open the person's group, show them, and bring the row into view. */
  const reveal = (id: string) => {
    const row = rows.find((candidate) => candidate.movement.id === id);
    if (row === undefined) return;
    // On a phone or tablet the panel is a sheet over the table, so focus goes to the sheet instead.
    explicitSelect.current = true;
    setSelectedId(id);
    setOpenGroups((current) => ({ ...current, [row.cause]: true }));
    setMoreGroups((current) => ({ ...current, [row.cause]: true }));
    if (sheet) return;
    window.requestAnimationFrame(() => {
      const button = document.querySelector<HTMLButtonElement>(`[data-testid="delays-select-${id}"]`);
      button?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      button?.focus({ preventScroll: true });
    });
  };

  // As a sheet the panel joins the shared modal stack: focus stays inside it and only the topmost
  // sheet answers Escape. Beside the table (wider screens) it is an ordinary panel.
  useWardModalFocus(sheet && selected !== null, panelRef, close);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedId !== null) {
        event.preventDefault();
        close();
      } else if (hasFilters(filters)) {
        event.preventDefault();
        setFilters(NO_FILTERS);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, filters, selectedId]);

  const over8 = rows.filter((row) => row.waited >= OVER_8H).length;
  const over24 = rows.filter((row) => row.waited >= OVER_24H).length;
  const dueSoon = rows.filter(isDueSoon).length;
  const breached = rows.filter(isBreached).length;
  const urgentMinutes = currentDueSoonThresholds().urgentMinutes;
  const soonHours = currentDueSoonThresholds().soonMinutes / 60;

  const heroStat = (
    value: number,
    label: string,
    tone: WfTone | undefined,
    pressed: boolean,
    onPress: (() => void) | undefined,
    testId: string,
  ) => {
    const body = (
      <>
        <span className={styles.statV}>{value}</span>
        <span className={styles.statL}>
          <Glyph tone={value > 0 ? tone : undefined} />
          {label}
        </span>
      </>
    );
    // A count with nobody behind it has nothing to filter, so it is plain text, not a dead button.
    if (onPress === undefined)
      return (
        <div className={`${styles.stat} ${styles.statStatic}`} data-testid={testId}>
          {body}
        </div>
      );
    return (
      <button type="button" className={styles.stat} aria-pressed={pressed} onClick={onPress} data-testid={testId}>
        {body}
      </button>
    );
  };

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.owner !== null)
    chips.push({ key: "owner", label: ownerName(filters.owner), clear: () => set({ owner: null }) });
  if (filters.origin !== null)
    chips.push({ key: "origin", label: catchmentName(filters.origin), clear: () => set({ origin: null }) });
  if (filters.cause !== null)
    chips.push({ key: "cause", label: causeTitle(filters.cause), clear: () => set({ cause: null }) });
  if (filters.dueSoon)
    chips.push({ key: "due", label: `Due within ${urgentMinutes}m`, clear: () => set({ dueSoon: false }) });
  if (filters.breached)
    chips.push({ key: "breached", label: "Past recorded time", clear: () => set({ breached: false }) });
  if (filters.bin !== null) {
    const bin = bins[filters.bin];
    chips.push({
      key: "bin",
      label: `Crossing ${formatInstantWithDay(now + bin.from, now)} to ${formatInstantWithDay(now + bin.to, now)}`,
      clear: () => set({ bin: null }),
    });
  }

  const renderRow = (row: BoardRow) => {
    const { movement } = row;
    const patient = patientOf(movement);
    const isSelected = selectedId === movement.id;
    const ward = wardSummary(row, units);
    const matches = !highlightActive || matchesRow(row);
    return [
      <tr
        role="row"
        key={movement.id}
        className={styles.r}
        aria-selected={isSelected}
        data-delays-row-matches={highlightActive ? (matches ? "true" : "false") : undefined}
        data-testid={`delays-row-${movement.id}`}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button, a") === null) select(movement.id);
        }}
      >
        <td role="cell" className={styles.who}>
          <button
            type="button"
            className={styles.whoBtn}
            aria-expanded={isSelected}
            onClick={() => select(movement.id)}
            data-testid={`delays-select-${movement.id}`}
          >
            <b className={styles.ellBlock}>{patient.formalName}</b>
            <span className={styles.ellBlock} data-ward-type-floor="delays-profile">
              {[patient.umrn, originLabel(movement)].filter(Boolean).join(" · ")}
            </span>
          </button>
        </td>
        <td role="cell" className={styles.cWait}>
          <span className={styles.wcell}>
            <span className={`${styles.wt} ${styles.num}`} data-ward-type-floor="delays-wait">
              <Glyph tone={waitTone(row.waited)} />
              {splitDuration(row.waited)}
            </span>
            <WaitBar row={row} />
          </span>
        </td>
        <td role="cell" className={styles.cTier}>
          <TierTile tier={movement.urgency} label={urgencyTierLabel(movement.urgency)} />
        </td>
        <td role="cell" className={styles.cWard} data-ward-type-floor="delays-cause">
          <span className={styles.lg}>
            {flat ? (
              <span className={styles.ell}>{causeTitle(row.cause)}</span>
            ) : (
              <>
                <Glyph tone={ward.tone} />
                <span className={styles.ell}>{ward.text}</span>
              </>
            )}
          </span>
        </td>
        <td role="cell" className={styles.cLegal}>
          {legalCell(row)}
        </td>
        <td role="cell" className={styles.cUpd} data-ward-type-floor="delays-since">
          {updateCell(row, now)}
        </td>
      </tr>,
      isSelected ? (
        <tr role="row" key={`${movement.id}-timeline`} className={styles.xrow}>
          <td role="cell" colSpan={6}>
            <RowTimeline row={row} units={units} now={now} />
          </td>
        </tr>
      ) : null,
    ];
  };

  /** Up, down, Home and End move between the people in the table. */
  const onListKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const current = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-testid^="delays-select-"]');
    if (current === null) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-testid^="delays-select-"]'),
    );
    const index = buttons.indexOf(current);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowDown"
            ? Math.min(buttons.length - 1, index + 1)
            : Math.max(0, index - 1);
    event.preventDefault();
    buttons[next]?.focus();
  };

  const byWait = (a: BoardRow, b: BoardRow) => b.waited - a.waited;
  let body: ReactNode[] = [];
  if (!flat) {
    for (const group of groups) {
      const list = rows.filter((row) => row.cause === group.cause).sort(byWait);
      if (list.length === 0) continue;
      const matchingInGroup = highlightActive ? list.filter(matchesRow).length : list.length;
      const open = isOpenGroup(group.cause);
      const limit = moreGroups[group.cause] ? list.length : GROUP_LIMIT;
      const owner = list[0].owner;
      body.push(
        <tr role="row" key={`group-${group.cause}`} className={styles.grpH}>
          <td role="cell" colSpan={6}>
            <button
              type="button"
              className={styles.gin}
              aria-expanded={open}
              onClick={() => setOpenGroups((current) => ({ ...current, [group.cause]: !open }))}
              data-testid={`delays-cause-${group.cause}`}
              data-severe={list[0].severe}
            >
              <ChevronDown size={14} aria-hidden="true" className={open ? undefined : styles.folded} />
              <Glyph tone={list[0].severe ? "danger" : undefined} />
              <span className={styles.gTitle}>{group.title}</span>
              <span className={styles.k} data-delays-group-count>
                {highlightActive ? matchingInGroup : list.length}
              </span>
              <span className={styles.mut}>{`${ownerName(owner)} to clear`}</span>
              <span className={styles.sp} />
              <span className={styles.mut}>
                Longest <span className={styles.num}>{splitDuration(list[0].waited)}</span>
              </span>
              <BandBar bands={bandCounts(list)} className={styles.minibar} />
            </button>
          </td>
        </tr>,
      );
      if (open) {
        body.push(...list.slice(0, limit).flatMap(renderRow));
        if (list.length > limit)
          body.push(
            <tr role="row" key={`more-${group.cause}`} className={styles.more}>
              <td role="cell" colSpan={6}>
                <button
                  type="button"
                  className={styles.moreBtn}
                  onClick={() => setMoreGroups((current) => ({ ...current, [group.cause]: true }))}
                >
                  {`Show ${list.length - limit} more`}
                </button>
              </td>
            </tr>,
          );
      }
    }
  } else {
    const pinned = rows.filter(isPinned).sort((a, b) => (a.dueIn ?? 0) - (b.dueIn ?? 0));
    const rest = rows.filter((row) => !isPinned(row)).sort(byWait);
    if (pinned.length > 0) {
      body.push(
        <tr role="row" key="pinned" className={`${styles.grpH} ${styles.grpStatic}`}>
          <td role="cell" colSpan={6}>
            <span className={styles.gin}>
              <Glyph tone="danger" />
              <span className={styles.gTitle}>{`Recorded time due within ${soonHours}h`}</span>
              <span className={styles.k}>{pinned.length}</span>
              <span className={styles.mut}>Pinned first</span>
            </span>
          </td>
        </tr>,
        ...pinned.flatMap(renderRow),
      );
      if (rest.length > 0)
        body.push(
          <tr role="row" key="rest" className={`${styles.grpH} ${styles.grpStatic}`}>
            <td role="cell" colSpan={6}>
              <span className={styles.gin}>
                <span className={styles.gTitle}>Everyone else</span>
                <span className={styles.k}>{rest.length}</span>
                <span className={styles.mut}>Longest wait first</span>
              </span>
            </td>
          </tr>,
        );
    }
    body.push(...rest.flatMap(renderRow));
  }
  const registers = (
    <Registers
      escalated={escalated}
      attention={attention}
      closedToday={closedToday}
      rows={rows}
      now={now}
      units={units}
      service={service}
      isOutsideService={isOutsideService}
      silentPressed={filters.silent}
      onSilent={() => set({ silent: !filters.silent })}
      onPick={reveal}
      onNotWired={onNotWired}
    />
  );
  const tiles = ownerTiles(rows);
  const cumulative = WAIT_THRESHOLDS.map((limit) => rows.filter((row) => row.waited >= limit).length);

  return (
    <>
      <Hero
        level={1}
        eyebrow="Delays"
        title={`${rows.length} ${rows.length === 1 ? "person" : "people"} waiting`}
        testId="delays-hero"
        stats={
          <div className={styles.stats} role="group" aria-label="Filter by the headline counts">
            {heroStat(
              over8,
              `Over ${H8}`,
              "warning",
              filters.threshold === 1,
              over8 > 0 || filters.threshold === 1 ? () => toggle("threshold", 1) : undefined,
              "delays-stat-over8",
            )}
            {heroStat(
              over24,
              `Over ${H24}`,
              "danger",
              filters.threshold === 3,
              over24 > 0 || filters.threshold === 3 ? () => toggle("threshold", 3) : undefined,
              "delays-stat-over24",
            )}
            {heroStat(
              dueSoon,
              `Due within ${urgentMinutes}m`,
              "danger",
              filters.dueSoon,
              dueSoon > 0 || filters.dueSoon
                ? () => {
                    toggle("dueSoon", true);
                    if (!filters.dueSoon) setFlat(true);
                  }
                : undefined,
              "delays-stat-due",
            )}
            {heroStat(
              breached,
              "Past recorded time",
              "danger",
              filters.breached,
              breached > 0 || filters.breached
                ? () => {
                    toggle("breached", true);
                    if (!filters.breached) setFlat(true);
                  }
                : undefined,
              "delays-stat-breached",
            )}
          </div>
        }
      />
      {banner}
      {empty !== undefined ? (
        <div className={styles.split}>
          <section className={`${styles.card} ${styles.emptyCard}`} aria-label="Waiting">
            {empty}
          </section>
          {registers}
        </div>
      ) : (
        <>
          <section className={`${styles.card} ${styles.owners}`} aria-label="Whose move" data-ward-primitive="panel">
            {tiles.map((tile) => (
              <button
                key={tile.owner}
                type="button"
                className={styles.own}
                aria-pressed={filters.owner === tile.owner}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    owner: current.owner === tile.owner ? null : tile.owner,
                    cause: null,
                  }))
                }
                data-testid={`delays-owner-${tile.owner}`}
              >
                <span className={styles.ownTop}>
                  <b className={styles.num}>{tile.rows.length}</b>
                  <span className={styles.ownName}>{tile.name}</span>
                </span>
                <BandBar bands={tile.bands} />
                <small>
                  <Glyph tone={tile.sub.count > 0 ? tile.sub.tone : undefined} />
                  {`${tile.sub.count} ${tile.sub.text}`}
                </small>
              </button>
            ))}
          </section>

          <div className={styles.split} data-person-open={selected !== null || undefined}>
            <section
              ref={tableRef}
              id="delays-table"
              className={`${styles.card} ${styles.tableCard}`}
              aria-label="Waiting"
              data-ward-primitive="panel"
              tabIndex={-1}
            >
              <div className={styles.chead}>
                <h2>{flat ? "Waiting" : "Waiting by blocker"}</h2>
                <span
                  className={styles.meta}
                  data-testid="delays-shown-count"
                >{`${matching.length} of ${rows.length}`}</span>
                <span className={styles.wlegend} aria-hidden="true">
                  <span>
                    <i className={styles.lgAct} />
                    Active
                  </span>
                  <span>
                    <i className={styles.lgQuiet} />
                    Quiet
                  </span>
                  <span>
                    <i className={styles.lgQuietLong} />
                    {`Quiet ${SILENT_MINUTES / 60}h+`}
                  </span>
                </span>
                <span className={styles.sp} />
                <label className={styles.search}>
                  <Search size={14} aria-hidden="true" />
                  <input
                    type="search"
                    value={filters.search}
                    onChange={(event) => set({ search: event.target.value })}
                    placeholder="Find a person or ED"
                    aria-label="Find a person or ED"
                    autoComplete="off"
                  />
                </label>
                <div className={styles.seg} role="group" aria-label="Order the table">
                  <button type="button" aria-pressed={!flat} onClick={() => setFlat(false)}>
                    By blocker
                  </button>
                  <button type="button" aria-pressed={flat} onClick={() => setFlat(true)}>
                    Longest wait
                  </button>
                </div>
              </div>
              <div className={`${styles.chead} ${styles.fRow}`}>
                <span className={styles.eyebrow}>Waited</span>
                <div className={styles.seg} role="group" aria-label="Waited at least">
                  {WAIT_THRESHOLD_LABELS.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={filters.threshold === index}
                      disabled={index > 0 && cumulative[index] === 0 && filters.threshold !== index}
                      onClick={() => {
                        if (index > 0 && cumulative[index] === 0 && filters.threshold !== index) return;
                        set({ threshold: filters.threshold === index ? 0 : (index as WaitThreshold) });
                      }}
                    >
                      <Glyph tone={index === 1 ? "warning" : index === 3 ? "danger" : undefined} />
                      {label} <span className={styles.k}>{cumulative[index]}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={styles.chip}
                  aria-pressed={filters.locked}
                  onClick={() => set({ locked: !filters.locked })}
                >
                  Locked bed <span className={styles.k}>{rows.filter((row) => row.locked).length}</span>
                </button>
                <button
                  type="button"
                  className={styles.chip}
                  aria-pressed={filters.silent}
                  onClick={() => set({ silent: !filters.silent })}
                >
                  <Glyph tone="warning" />
                  {`Silent ${SILENT_MINUTES / 60}h+`}{" "}
                  <span className={styles.k}>{rows.filter((row) => row.silent).length}</span>
                </button>
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className={styles.chip}
                    aria-pressed="true"
                    aria-label={`Remove filter ${chip.label}`}
                    onClick={chip.clear}
                  >
                    {chip.label}
                    <X size={12} aria-hidden="true" />
                  </button>
                ))}
                <span className={styles.sp} />
                {filtered ? (
                  <button type="button" className={styles.lnk} onClick={() => setFilters(NO_FILTERS)}>
                    Clear
                  </button>
                ) : null}
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.tbl} data-testid="delays-waiting-list" role="table">
                  <colgroup>
                    <col className={styles.colP} />
                    <col className={styles.colW} />
                    <col className={styles.colT} />
                    <col className={styles.colB} />
                    <col className={styles.colL} />
                    <col />
                  </colgroup>
                  <thead role="rowgroup">
                    <tr role="row">
                      <th scope="col" role="columnheader">
                        Person
                      </th>
                      <th scope="col" role="columnheader">
                        Waited
                      </th>
                      <th scope="col" role="columnheader">
                        <abbr title="Urgency tier">T</abbr>
                      </th>
                      <th scope="col" role="columnheader">
                        {flat ? "Blocker" : "Wards"}
                      </th>
                      <th scope="col" role="columnheader">
                        Legal
                      </th>
                      <th scope="col" role="columnheader">
                        Last update
                      </th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup" onKeyDown={onListKey}>
                    {body}
                  </tbody>
                </table>
              </div>
            </section>

            {selected !== null ? (
              <>
                <div
                  className={styles.backdrop}
                  onClick={close}
                  aria-hidden="true"
                  data-testid="delays-detail-backdrop"
                />
                <PersonPanel
                  row={selected}
                  units={units}
                  now={now}
                  onClose={close}
                  onEscalate={onEscalate}
                  panelRef={panelRef}
                />
              </>
            ) : (
              registers
            )}
          </div>

          <DelaysBoardGraphs
            rows={rows}
            shown={matching}
            bins={bins}
            now={now}
            filters={filters}
            catchments={boardCatchments(rows)}
            selectedId={selectedId}
            onFilters={(patch, toFlat) => {
              set(patch);
              if (toFlat) setFlat(true);
            }}
            onClear={() => setFilters(NO_FILTERS)}
            onPick={reveal}
            onToTable={() => {
              tableRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
              tableRef.current?.focus({ preventScroll: true });
            }}
          />
        </>
      )}
    </>
  );
}
