"use client";

import { Fragment, useId, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDownUp, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { splitDuration, type Instant } from "../ward-clock";
import type { Movement } from "../ward-model";
import { usePatientOf } from "../ward-patient-name";
import { edById } from "../ward-sites";
import { departmentLabel } from "../ward-absence-labels";
import { WardPanel } from "../ward-panel";
import { WardFilters } from "../ward-controls";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES, OPERATIONAL_DEFAULT_LABEL } from "../ward-operational-defaults";
import {
  DELAY_CAUSE_COPY,
  DELAY_OWNERS,
  SEVERE_CAUSES,
  lastRecordedActivity,
  legalDeadlineMinutes,
  ownerOf,
  type DelayCause,
  type DelayGroup,
  type DelayOwnerId,
} from "./delays-derivations";
import { delayTimelineScale, delayTimelineSegments } from "./delays-view-model";
import styles from "./delays-data-views.module.css";

type DelayRecord = { movement: Movement; cause: DelayCause };
type Sort = "worstBlocker" | "longestWait" | "legalDeadline" | "triageRank";

function originName(movement: Movement) {
  return departmentLabel(movement.originEdId, edById(movement.originEdId)?.name);
}

function ownerName(owner: DelayOwnerId) {
  return owner === "yours" ? "Coordinator" : (DELAY_OWNERS.find((entry) => entry.id === owner)?.name ?? owner);
}

function causeName(cause: DelayCause) {
  return DELAY_CAUSE_COPY.find((entry) => entry.cause === cause)?.title ?? cause;
}

function recordedUpdate(movement: Movement, now: Instant) {
  const activity = lastRecordedActivity(movement, now);
  return activity === undefined || activity.what === "the journey opened"
    ? "Arrival only"
    : `${splitDuration(Math.max(0, now - activity.at))} ago`;
}

function OwnerBadge({ owner }: { owner: DelayOwnerId }) {
  return (
    <span className={styles.ownerBadge} data-owner={owner}>
      {ownerName(owner)}
    </span>
  );
}

const subscribeToClient = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function SearchField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  // Text input events cannot be replayed before this client component hydrates.
  const ready = useSyncExternalStore(subscribeToClient, clientReady, serverReady);
  return (
    <label className={styles.search}>
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        value={value}
        disabled={!ready}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Find a person, ED or blocker…"
        aria-label={label}
      />
    </label>
  );
}

/** The named, linear alternative to the radar. It reads the same scoped records as the tables. */
export function DelaysWaitTimeline({
  rows,
  now,
  onSelect,
}: {
  rows: DelayRecord[];
  now: Instant;
  onSelect: (id: string) => void;
}) {
  const patientOf = usePatientOf();
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<DelayOwnerId | "all">("all");
  const [page, setPage] = useState(0);
  const pageSize = 6;
  const matching = rows
    .filter(({ movement, cause }) => {
      const text = `${patientOf(movement).formalName} ${originName(movement)} ${causeName(cause)} ${movement.blocker}`;
      return (owner === "all" || ownerOf(cause) === owner) && text.toLowerCase().includes(query.trim().toLowerCase());
    })
    .sort((a, b) => a.movement.openedAt - b.movement.openedAt || a.movement.id.localeCompare(b.movement.id));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(matching.length / pageSize) - 1));
  const shown = matching.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const scale = delayTimelineScale(
    matching.map(({ movement }) => movement),
    now,
  );
  const reviewAt = (ED_SEVERE_PRESSURE_WAIT_MINUTES / scale) * 100;

  return (
    <WardPanel
      title="Wait timeline"
      count={`${matching.length} people`}
      blurb="See the wait and the last recorded change. Longest waits first; all times come from the current records."
    >
      <div className={styles.toolbar}>
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(0);
          }}
          label="Filter wait timeline"
        />
        <label className={styles.selectLabel}>
          Responsible team
          <select
            value={owner}
            onChange={(event) => {
              setOwner(event.target.value as typeof owner);
              setPage(0);
            }}
          >
            <option value="all">All teams</option>
            {DELAY_OWNERS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {ownerName(entry.id)}
              </option>
            ))}
          </select>
        </label>
        <span className={styles.sortHint}>
          <ArrowDownUp size={15} aria-hidden="true" /> Longest wait
        </span>
      </div>
      <div
        className={styles.tableScroll}
        tabIndex={0}
        role="region"
        aria-label="Wait timeline table, scroll horizontally for all columns"
      >
        <table className={`${styles.table} ${styles.timelineTable}`}>
          <caption className="sr-only">
            Time waiting and time since the last recorded update, by person. The review marker is an operational
            default, not a legal deadline.
          </caption>
          <thead>
            <tr>
              <th scope="col">Patient &amp; ED</th>
              <th scope="col" className={styles.axisCell}>
                <div className={styles.axis} aria-label={`Linear time scale, zero to ${scale / 60} hours`}>
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                    <span key={fraction} style={{ left: `${fraction * 100}%` }}>
                      {fraction === 0 ? "0h" : splitDuration(scale * fraction)}
                    </span>
                  ))}
                </div>
              </th>
              <th scope="col">ED wait</th>
              <th scope="col">Reason for delay</th>
              <th scope="col">Responsible team</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ movement, cause }) => {
              const segment = delayTimelineSegments(movement, now, scale);
              const name = patientOf(movement).formalName;
              return (
                <tr key={movement.id}>
                  <th scope="row">
                    <button
                      type="button"
                      className={styles.patientButton}
                      onClick={() => onSelect(movement.id)}
                      aria-label={`Inspect timeline for ${name}`}
                    >
                      {name} <span className={styles.urgency}>T{movement.urgency}</span>
                      <span className={`${styles.secondary} ${styles.patientMeta}`}>{originName(movement)}</span>
                    </button>
                  </th>
                  <td className={styles.trackCell}>
                    <span className={styles.secondary}>
                      {segment.activity === undefined
                        ? "No change recorded since arrival"
                        : `Last update ${recordedUpdate(movement, now)}`}
                    </span>
                    <div
                      className={styles.track}
                      aria-label={`${splitDuration(segment.waiting)} waiting; ${segment.activity === undefined ? "no change recorded since arrival" : `${splitDuration(segment.quiet)} since last update`}`}
                    >
                      <span className={styles.reviewLine} style={{ left: `${reviewAt}%` }} aria-hidden="true" />
                      <span
                        className={styles.beforeUpdate}
                        style={{ width: `${segment.beforeWidth}%` }}
                        aria-hidden="true"
                      />
                      <span
                        className={styles.quietWait}
                        style={{ left: `${segment.beforeWidth}%`, width: `${segment.quietWidth}%` }}
                        aria-hidden="true"
                      />
                      {segment.activity !== undefined && (
                        <span
                          className={styles.updateDot}
                          style={{ left: `${segment.beforeWidth}%` }}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </td>
                  <td className={styles.wait} data-long={segment.waiting >= ED_SEVERE_PRESSURE_WAIT_MINUTES}>
                    {splitDuration(segment.waiting)}
                  </td>
                  <td>{causeName(cause)}</td>
                  <td>
                    <OwnerBadge owner={ownerOf(cause)} />
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  No people match this timeline.{" "}
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => {
                      setQuery("");
                      setOwner("all");
                    }}
                  >
                    Clear timeline filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className={styles.timelineLegend}>
        <span>
          <i className={styles.solidKey} /> Time before last update
        </span>
        <span>
          <i className={styles.hatchKey} /> Time since last recorded update
        </span>
        <span>
          <i className={styles.dotKey} /> Recorded update
        </span>
        <span>
          <i className={styles.reviewKey} /> {ED_SEVERE_PRESSURE_WAIT_MINUTES / 60}h review marker ·{" "}
          {OPERATIONAL_DEFAULT_LABEL}
        </span>
      </div>
      <div className={styles.footer}>
        <span aria-live="polite">
          {matching.length === 0
            ? "0 people"
            : `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, matching.length)} of ${matching.length} people`}
        </span>
        <div className={styles.pagination}>
          <button
            type="button"
            disabled={currentPage === 0}
            aria-label="Previous timeline page"
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span>
            Page {currentPage + 1} of {Math.max(1, Math.ceil(matching.length / pageSize))}
          </span>
          <button
            type="button"
            disabled={(currentPage + 1) * pageSize >= matching.length}
            aria-label="Next timeline page"
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </WardPanel>
  );
}

type WorkspaceProps = {
  rows: DelayRecord[];
  groups: DelayGroup[];
  now: Instant;
  selectedId: string | null;
  onSelect: (id: string) => void;
  detail: ReactNode;
  markLabel: string | null;
  markedCount: number;
  isMarked: (movement: Movement, cause: DelayCause) => boolean;
  delayFilterId: string;
  onMarkFilter: (id: string) => void;
  onMarkCause: (cause: DelayCause) => void;
  markedCause: DelayCause | null;
  onListKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

/** Two presentations of the same waiting and blocker tables. Filters and selection survive tab changes. */
export function DelaysTableWorkspace(props: WorkspaceProps) {
  const { rows, groups, now, selectedId, onSelect, detail, markLabel, markedCount, isMarked } = props;
  const patientOf = usePatientOf();
  const id = useId();
  const [view, setView] = useState<"focus" | "workspace">("focus");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<DelayOwnerId | "all">("all");
  const [causeFilter, setCauseFilter] = useState<DelayCause | "all">("all");
  const [sort, setSort] = useState<Sort>("worstBlocker");
  const filtered = rows
    .filter(({ movement, cause }) => {
      const text = `${patientOf(movement).formalName} ${movement.id} ${originName(movement)} ${causeName(cause)} ${movement.blocker}`;
      return (
        text.toLowerCase().includes(query.trim().toLowerCase()) &&
        (owner === "all" || ownerOf(cause) === owner) &&
        (causeFilter === "all" || cause === causeFilter)
      );
    })
    .sort((a, b) => {
      if (sort === "triageRank")
        return a.movement.urgency - b.movement.urgency || a.movement.openedAt - b.movement.openedAt;
      if (sort === "legalDeadline")
        return (
          (legalDeadlineMinutes(a.movement, now) ?? Infinity) - (legalDeadlineMinutes(b.movement, now) ?? Infinity) ||
          a.movement.openedAt - b.movement.openedAt
        );
      if (sort === "worstBlocker")
        return (
          DELAY_CAUSE_COPY.findIndex((entry) => entry.cause === a.cause) -
            DELAY_CAUSE_COPY.findIndex((entry) => entry.cause === b.cause) || a.movement.openedAt - b.movement.openedAt
        );
      return a.movement.openedAt - b.movement.openedAt || a.movement.id.localeCompare(b.movement.id);
    });
  const filtersActive = query !== "" || owner !== "all" || causeFilter !== "all";
  const clearFilters = () => {
    setQuery("");
    setOwner("all");
    setCauseFilter("all");
  };
  const tabs = [
    { key: "focus", label: "Focus table", number: "01" },
    { key: "workspace", label: "Action workspace", number: "02" },
  ] as const;
  const changeTab = (next: typeof view) => {
    setView(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };

  const blockerTable = (
    <WardPanel title="What the blocker is" count={`${groups.length} causes`}>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Blocker groups">
        <table className={`${styles.table} ${styles.blockerTable}`}>
          <caption className="sr-only">
            One worst blocker per waiting person, across the current service scope. Select a cause to mark matching
            people. Use the Cause filter to narrow the waiting table.
          </caption>
          <thead>
            <tr>
              <th scope="col">Blocker</th>
              <th scope="col">Team</th>
              <th scope="col" className={styles.numeric}>
                Waiting
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.cause} data-active={causeFilter === group.cause}>
                <th scope="row">
                  <button
                    type="button"
                    className={styles.causeButton}
                    data-testid={`delays-cause-${group.cause}`}
                    aria-pressed={props.markedCause === group.cause}
                    data-severe={SEVERE_CAUSES.includes(group.cause)}
                    onClick={() => {
                      props.onMarkCause(group.cause);
                    }}
                  >
                    {group.title}
                  </button>
                  {group.note && <span className={styles.secondary}>{group.note}</span>}
                </th>
                <td>
                  <OwnerBadge owner={ownerOf(group.cause)} />
                </td>
                <td className={styles.numeric}>{group.movements.length}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total waiting</th>
              <td />
              <td className={styles.numeric}>{rows.length}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={styles.note}>One worst blocker per waiting person. Counts cover the current service scope.</p>
    </WardPanel>
  );

  return (
    <section className={styles.workspace} aria-label="Delay table layouts">
      <div className={styles.layoutHeader}>
        <div>
          <h2>Waiting &amp; blockers</h2>
          <p>Two ways to work with the same records.</p>
        </div>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Delay table layout"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            changeTab(
              event.key === "Home"
                ? "focus"
                : event.key === "End"
                  ? "workspace"
                  : view === "focus"
                    ? "workspace"
                    : "focus",
            );
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`${id}-tab-${tab.key}`}
              aria-controls={`${id}-panel`}
              aria-selected={view === tab.key}
              tabIndex={view === tab.key ? 0 : -1}
              onClick={() => setView(tab.key)}
            >
              <span>{tab.number}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${view}`}
        className={styles.layout}
        data-layout={view}
      >
        {view === "workspace" && (
          <aside className={styles.teamRail} aria-label="Responsible team queues">
            <h3>Responsible team</h3>
            <button
              type="button"
              aria-pressed={owner === "all"}
              onClick={() => {
                setOwner("all");
                setCauseFilter("all");
              }}
            >
              <span>All teams</span>
              <strong>{rows.length}</strong>
            </button>
            {DELAY_OWNERS.map((entry) => (
              <button
                type="button"
                key={entry.id}
                aria-pressed={owner === entry.id}
                onClick={() => {
                  setOwner(entry.id);
                  setCauseFilter("all");
                }}
              >
                <span>{ownerName(entry.id)}</span>
                <strong>{rows.filter((row) => ownerOf(row.cause) === entry.id).length}</strong>
              </button>
            ))}
            <p>Select a team to see the people waiting on its next step.</p>
          </aside>
        )}
        <div className={styles.waitingPanel}>
          <WardPanel
            title="Waiting"
            count={markLabel === null ? `${rows.length}` : `${markedCount} of ${rows.length} marked · ${markLabel}`}
          >
            <div className={styles.toolbar}>
              <SearchField value={query} onChange={setQuery} label="Filter patient worklist" />
              <label className={styles.selectLabel}>
                Team
                <select value={owner} onChange={(event) => setOwner(event.target.value as typeof owner)}>
                  <option value="all">All teams</option>
                  {DELAY_OWNERS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {ownerName(entry.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.selectLabel}>
                Cause
                <select
                  value={causeFilter}
                  onChange={(event) => setCauseFilter(event.target.value as typeof causeFilter)}
                >
                  <option value="all">All causes</option>
                  {groups.map((group) => (
                    <option key={group.cause} value={group.cause}>
                      {group.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.selectLabel}>
                Sort
                <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                  <option value="worstBlocker">Worst blocker first</option>
                  <option value="longestWait">Longest ED wait</option>
                  <option value="legalDeadline">Recorded due time</option>
                  <option value="triageRank">Triage rank (T1–T3)</option>
                </select>
              </label>
            </div>
            <div className={styles.markBar}>
              <WardFilters
                legend="Mark"
                activeId={props.delayFilterId}
                onChange={props.onMarkFilter}
                options={[
                  { id: "waiting", label: "People waiting", count: rows.length },
                  {
                    id: "locked",
                    label: "Needs a locked bed",
                    count: rows.filter(({ movement }) => movement.security === "Secure").length,
                  },
                  {
                    id: "escalated",
                    label: "Escalated",
                    count: rows.filter(({ movement }) => movement.escalation !== undefined).length,
                  },
                ]}
              />
              {filtersActive && (
                <button type="button" className={styles.textButton} onClick={clearFilters}>
                  Clear table filters
                </button>
              )}
            </div>
            {causeFilter !== "all" && (
              <p className={styles.filterNote}>
                Blocker: <strong>{causeName(causeFilter)}</strong>
              </p>
            )}
            <div
              className={styles.worklistScroll}
              tabIndex={0}
              aria-label="Waiting table, scroll for more people and columns"
            >
              <table className={`${styles.table} ${styles.waitingTable}`}>
                <caption className="sr-only">
                  Waiting people, their ED waits, blockers, responsible teams and last recorded updates.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col" className={styles.fromColumn}>
                      From
                    </th>
                    <th scope="col">ED wait</th>
                    <th scope="col">Blocker</th>
                    <th scope="col" className={styles.ownerColumn}>
                      Team
                    </th>
                    <th scope="col">Last recorded update</th>
                    <th scope="col">
                      <span className="sr-only">Open movement</span>
                    </th>
                  </tr>
                </thead>
                <tbody data-testid="delays-waiting-list" data-ward-primitive="list" onKeyDown={props.onListKeyDown}>
                  {filtered.map(({ movement, cause }) => {
                    const name = patientOf(movement).formalName;
                    const marked = isMarked(movement, cause);
                    const selected = movement.id === selectedId;
                    const legalMinutes = legalDeadlineMinutes(movement, now);
                    return (
                      <Fragment key={movement.id}>
                        <tr data-selected={selected} data-dimmed={markLabel !== null && !marked}>
                          <th scope="row">
                            <button
                              type="button"
                              className={styles.patientButton}
                              aria-label={`Select patient ${patientOf(movement).displayName}`}
                              aria-pressed={selected}
                              onClick={() => onSelect(movement.id)}
                              data-testid={`delays-select-${movement.id}`}
                              data-ward-primitive="record-row"
                              data-record-key={movement.id}
                              data-owner={ownerOf(cause)}
                              data-severe={SEVERE_CAUSES.includes(cause)}
                            >
                              <span data-ward-primitive="record-id">{name}</span>
                              <span className={styles.urgency} data-tier={movement.urgency}>
                                T{movement.urgency}
                              </span>
                              {marked && markLabel !== null && (
                                <span className={styles.secondary}>Marked: {markLabel}</span>
                              )}
                              {view === "workspace" && (
                                <span className={`${styles.secondary} ${styles.patientMeta}`}>
                                  {originName(movement)}
                                </span>
                              )}
                              <span
                                className={`${styles.profile} ${styles.patientMeta}`}
                                data-ward-type-floor="delays-profile"
                              >
                                {movement.security === "Secure" ? "Needs a locked bed" : "An open bed suits"}
                              </span>
                            </button>
                          </th>
                          <td className={styles.fromColumn}>{originName(movement)}</td>
                          <td
                            className={styles.wait}
                            data-ward-type-floor="delays-wait"
                            data-long={now - movement.openedAt >= ED_SEVERE_PRESSURE_WAIT_MINUTES}
                          >
                            {splitDuration(Math.max(0, now - movement.openedAt))}
                          </td>
                          <td className={styles.cause} data-ward-type-floor="delays-cause">
                            {causeName(cause)}
                            {legalMinutes !== undefined && legalMinutes <= 60 && (
                              <span className={styles.legalNote}>
                                {legalMinutes < 0
                                  ? `Past recorded due time by ${splitDuration(Math.abs(legalMinutes))}`
                                  : `Recorded due time in ${splitDuration(legalMinutes)}`}{" "}
                                · Limits not checked
                              </span>
                            )}
                          </td>
                          <td className={styles.ownerColumn}>
                            <OwnerBadge owner={ownerOf(cause)} />
                          </td>
                          <td>
                            <span className={styles.update} data-ward-type-floor="delays-since">
                              {recordedUpdate(movement, now)}
                            </span>
                          </td>
                          <td>
                            <Link
                              className={styles.openLink}
                              href={`/mockups/ward-flow/movements/${movement.id}`}
                              aria-label={`Open movement for ${name}`}
                            >
                              <ChevronRight size={18} aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                        {selected && view === "focus" && (
                          <tr className={styles.detailRow}>
                            <td colSpan={7}>{detail}</td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className={styles.empty} data-testid="delays-empty-state">
                        No active delays match your current filters.{" "}
                        <button type="button" className={styles.textButton} onClick={clearFilters}>
                          Clear active filters
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className={styles.footer}>
              <span aria-live="polite">
                {filtered.length} people shown · {rows.length} total · Synthetic prototype
              </span>
              <span>
                {sort === "worstBlocker"
                  ? "Worst blocker first, then longest wait."
                  : sort === "longestWait"
                    ? "Longest ED wait first."
                    : sort === "legalDeadline"
                      ? "Recorded due time first; limits not checked."
                      : "Triage rank first, then longest wait."}
              </span>
            </div>
          </WardPanel>
          {view === "focus" && selectedId !== null && !filtered.some(({ movement }) => movement.id === selectedId) && (
            <div className={styles.inspection}>{detail}</div>
          )}
        </div>
        <div className={styles.blockerPanel}>
          {view === "workspace" && (
            <div className={styles.inspection}>
              {selectedId === null ? (
                <div className={styles.noSelection}>
                  <h3>Patient details</h3>
                  <p>Select a person in the waiting table to inspect their recorded delay and next steps.</p>
                </div>
              ) : (
                detail
              )}
            </div>
          )}
          {blockerTable}
        </div>
      </div>
    </section>
  );
}
