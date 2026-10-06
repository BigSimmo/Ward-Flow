"use client";

import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  BusFront,
  ChartNoAxesColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Flag,
  Search,
  Table2,
  Users,
  X,
} from "lucide-react";
import { legalFormName } from "../ward-legal-forms";
import { splitDuration, type Instant } from "../ward-clock";
import type { Movement } from "../ward-model";
import { usePatientOf } from "../ward-patient-name";
import { edById } from "../ward-sites";
import { departmentLabel } from "../ward-absence-labels";
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
const SHORT_CAUSE: Record<DelayCause, string> = {
  legal_breached: "Form due time already passed",
  legal_expiring: "Form due time running out",
  no_eligible_bed: "No suitable bed",
  awaiting_ward_answer: "Awaiting ward answer",
  bed_pull_expired: "Reserved time passed; bed held",
  awaiting_bed_ready: "Bed not ready",
  awaiting_transport: "Awaiting transport",
  patient_or_family: "Patient or family factors",
  awaiting_coordinator: "Awaiting coordinator decision",
};
function originName(m: Movement) {
  return departmentLabel(m.originEdId, edById(m.originEdId)?.name);
}
function shortOrigin(m: Movement) {
  return originName(m)
    .replace(/ Emergency Department$/u, " ED")
    .replace(/^St John of God /u, "")
    .replace(/ (?:General Hospital|Hospital|Health Campus)(?= ED$)/u, "");
}
function ownerName(owner: DelayOwnerId) {
  return owner === "yours" ? "Coordinator" : (DELAY_OWNERS.find((entry) => entry.id === owner)?.name ?? owner);
}
function causeName(cause: DelayCause) {
  return DELAY_CAUSE_COPY.find((entry) => entry.cause === cause)?.title ?? cause;
}
function recordedUpdate(m: Movement, now: Instant) {
  const activity = lastRecordedActivity(m, now);
  return activity === undefined || activity.what === "the journey opened"
    ? "No update recorded"
    : `${splitDuration(Math.max(0, now - activity.at))} ago`;
}
function OwnerIcon({ owner }: { owner: DelayOwnerId }) {
  const Icon = owner === "wards" ? BedDouble : owner === "transport" ? BusFront : Users;
  return <Icon size={16} aria-hidden="true" />;
}
function OwnerBadge({ owner }: { owner: DelayOwnerId }) {
  return (
    <span className={styles.ownerBadge} data-owner={owner}>
      <OwnerIcon owner={owner} />
      {ownerName(owner)}
    </span>
  );
}
function Urgency({ movement }: { movement: Movement }) {
  return (
    <span className={styles.urgency} data-tier={movement.urgency}>
      T{movement.urgency}
    </span>
  );
}
function MovementLink({ movement, children }: { movement: Movement; children?: ReactNode }) {
  const patientOf = usePatientOf();
  return (
    <Link
      className={children ? styles.primaryLink : styles.openLink}
      href={`/mockups/ward-flow/movements/${movement.id}`}
      aria-label={`Open movement for ${patientOf(movement).formalName}`}
    >
      {children ?? <ChevronRight size={18} aria-hidden="true" />}
    </Link>
  );
}
const subscribeToClient = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
function SearchField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const ready = useSyncExternalStore(subscribeToClient, clientReady, serverReady);
  return (
    <label className={styles.search}>
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        value={value}
        disabled={!ready}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Find a person or ED…"
        aria-label={label}
      />
    </label>
  );
}
function TeamSelect({
  value,
  onChange,
}: {
  value: DelayOwnerId | "all";
  onChange: (value: DelayOwnerId | "all") => void;
}) {
  return (
    <label className={styles.selectLabel}>
      Owner
      <select
        aria-label="Responsible team"
        value={value}
        onChange={(event) => onChange(event.target.value as typeof value)}
      >
        <option value="all">All</option>
        {DELAY_OWNERS.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {ownerName(entry.id)}
          </option>
        ))}
      </select>
    </label>
  );
}
function PageControls({
  page,
  pages,
  onChange,
  label,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  label: string;
}) {
  return (
    <div className={styles.pagination}>
      <button
        type="button"
        disabled={page === 0}
        aria-label={`Previous ${label} page`}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft aria-hidden="true" size={18} />
      </button>
      <span>
        Page <b>{page + 1}</b> of {pages}
      </span>
      <button
        type="button"
        disabled={page + 1 >= pages}
        aria-label={`Next ${label} page`}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight aria-hidden="true" size={18} />
      </button>
    </div>
  );
}
function LegalNote({ movement, now }: { movement: Movement; now: Instant }) {
  const minutes = legalDeadlineMinutes(movement, now);
  if (minutes === undefined || minutes > 60 || !movement.legalForm) return null;
  return (
    <span className={styles.legalNote}>
      {legalFormName(movement.legalForm)}{" "}
      {minutes < 0 ? `passed its deadline ${splitDuration(Math.abs(minutes))} ago` : `due in ${splitDuration(minutes)}`}{" "}
      · Limits not checked
    </span>
  );
}
function CompactStrip({
  record,
  now,
  timeline = false,
  onClose,
}: {
  record: DelayRecord;
  now: Instant;
  timeline?: boolean;
  onClose?: () => void;
}) {
  const patientOf = usePatientOf();
  const { movement, cause } = record;
  return (
    <div
      className={styles.compactStrip}
      role="region"
      aria-label={timeline ? "Selected timeline details" : "Selected patient delay details"}
      data-delay-inspection={timeline ? "timeline" : "waiting"}
      tabIndex={-1}
    >
      {timeline ? (
        <>
          <strong>
            {patientOf(movement).formalName}
            <span className={styles.secondary}>
              T{movement.urgency} · {shortOrigin(movement)}
            </span>
          </strong>
          <div>
            <small>Waiting</small>
            <b>{splitDuration(Math.max(0, now - movement.openedAt))}</b>
          </div>
          <div>
            <small>Last change</small>
            <b>{recordedUpdate(movement, now)}</b>
          </div>
          <div>
            <small>Reason for wait</small>
            {SHORT_CAUSE[cause]}
          </div>
        </>
      ) : (
        <>
          <BedDouble size={23} aria-hidden="true" />
          <div className={styles.stripBed}>
            <b>Bed need</b>
            <span className={styles.profile} data-ward-type-floor="delays-profile">
              {movement.security === "Secure" ? "Locked" : "Open"} {movement.cohort.toLowerCase()} bed
            </span>
          </div>
          <FileText size={23} aria-hidden="true" />
          <div className={styles.stripStep}>
            <b>Next step</b>
            <span>Review recorded movement options</span>
            <LegalNote movement={movement} now={now} />
          </div>
        </>
      )}
      <MovementLink movement={movement}>
        Open movement <ArrowRight size={16} aria-hidden="true" />
      </MovementLink>
      {onClose && (
        <button
          className={styles.closeButton}
          type="button"
          aria-label="Close why this person is waiting"
          data-testid="delays-close-detail"
          onClick={onClose}
        >
          <X aria-hidden="true" size={17} />
        </button>
      )}
    </div>
  );
}
function PatientDossier({
  record,
  now,
  onClose,
  detail,
}: {
  record: DelayRecord;
  now: Instant;
  onClose?: () => void;
  detail: ReactNode;
}) {
  const patientOf = usePatientOf();
  const { movement, cause } = record;
  const activity = lastRecordedActivity(movement, now);
  const events = [
    ...(activity && activity.what !== "the journey opened" ? [{ at: activity.at, what: activity.what }] : []),
    { at: movement.openedAt, what: `Presented to ${shortOrigin(movement)}` },
  ];
  return (
    <aside
      className={styles.dossier}
      role="region"
      aria-label="Selected patient delay details"
      data-delay-inspection="waiting"
      tabIndex={-1}
      data-testid={`delays-detail-${movement.id}`}
    >
      <header>
        <div>
          <h3>{patientOf(movement).formalName}</h3>
          <span className={styles.synthetic}>Synthetic patient</span>
        </div>
        {onClose && (
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Close why this person is waiting"
            data-testid="delays-close-detail"
            onClick={onClose}
          >
            <X aria-hidden="true" size={18} />
          </button>
        )}
      </header>
      <p className={styles.dossierWait}>
        <b>{splitDuration(Math.max(0, now - movement.openedAt))}</b> in ED
      </p>
      <dl className={styles.facts}>
        <div>
          <dt>Urgency</dt>
          <dd>
            <Urgency movement={movement} />
          </dd>
        </div>
        <div>
          <dt>Responsible team</dt>
          <dd>
            <OwnerBadge owner={ownerOf(cause)} />
          </dd>
        </div>
        <div>
          <dt>From (ED)</dt>
          <dd>{shortOrigin(movement)}</dd>
        </div>
        <div>
          <dt>Blocker / cause</dt>
          <dd>{SHORT_CAUSE[cause]}</dd>
        </div>
        <div>
          <dt>Bed needed</dt>
          <dd>
            {movement.security === "Secure" ? "Locked" : "Open"} {movement.cohort.toLowerCase()} bed
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{movement.legalStatus}</dd>
        </div>
        <div className={styles.lastChange}>
          <dt>Last recorded change</dt>
          <dd>
            <Clock aria-hidden="true" size={16} />
            <b>{recordedUpdate(movement, now)}</b>
          </dd>
          <LegalNote movement={movement} now={now} />
        </div>
      </dl>
      <h4>Recorded activity</h4>
      <ol className={styles.activity}>
        {events.map((event, i) => (
          <li key={`${event.at}-${i}`}>
            <time>{splitDuration(Math.max(0, now - event.at))} ago</time>
            <span>{event.what}</span>
          </li>
        ))}
      </ol>
      <div className={styles.nextStep}>
        <Flag size={18} aria-hidden="true" />
        <div>
          <b>Next step</b>
          <strong>Review movement options</strong>
          <span>Open the movement to review recorded options.</span>
        </div>
        <MovementLink movement={movement}>
          Open movement <ArrowRight aria-hidden="true" size={15} />
        </MovementLink>
      </div>
      <details
        className={styles.moreTools}
        onToggle={(event) => {
          if (!event.currentTarget.open || !window.matchMedia("(max-width: 1099px)").matches) return;
          event.currentTarget
            .querySelector<HTMLElement>('[aria-label="Extended patient delay details"]')
            ?.focus({ preventScroll: true });
        }}
      >
        <summary>Patient actions and full details</summary>
        {detail}
      </details>
    </aside>
  );
}

/** A named linear timeline above the existing overview; geometry always uses the live clock. */
export function DelaysWaitTimeline({
  rows,
  now,
  onSelect,
  selectedId,
  embedded = false,
  onClose,
}: {
  rows: DelayRecord[];
  now: Instant;
  onSelect: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
  onClose?: () => void;
}) {
  const patientOf = usePatientOf();
  const inspectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      selectedId == null ||
      !embedded ||
      typeof window.matchMedia !== "function" ||
      !window.matchMedia("(max-width: 1099px)").matches
    )
      return;
    window.requestAnimationFrame(() => {
      const strip = inspectionRef.current?.querySelector<HTMLElement>('[data-delay-inspection="timeline"]');
      strip?.scrollIntoView({ block: "nearest" });
      strip?.focus({ preventScroll: true });
    });
  }, [selectedId, embedded]);
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<DelayOwnerId | "all">("all");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<"longestWait" | "triageRank">("longestWait");
  const [mode, setMode] = useState<"timeline" | "table">("timeline");
  const matching = rows
    .filter(
      ({ movement, cause }) =>
        (owner === "all" || ownerOf(cause) === owner) &&
        `${patientOf(movement).formalName} ${originName(movement)} ${causeName(cause)} ${movement.blocker}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort(
      (a, b) =>
        (sort === "triageRank" ? a.movement.urgency - b.movement.urgency : 0) ||
        a.movement.openedAt - b.movement.openedAt ||
        a.movement.id.localeCompare(b.movement.id),
    );
  const pageSize = 6;
  const pages = Math.max(1, Math.ceil(matching.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const shown = matching.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const scale = delayTimelineScale(
    matching.map(({ movement }) => movement),
    now,
  );
  const reviewAt = (ED_SEVERE_PRESSURE_WAIT_MINUTES / scale) * 100;
  const selected = matching.find(({ movement }) => movement.id === selectedId);
  return (
    <section
      className={`${styles.panel} ${styles.timelinePanel} ${embedded ? styles.polishedTimeline : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && selected && onClose) {
          event.preventDefault();
          onClose();
          document
            .querySelector<HTMLButtonElement>(`[data-testid="delays-timeline-select-${selected.movement.id}"]`)
            ?.focus();
        }
      }}
      role="region"
      aria-label="Wait timeline"
      data-ward-primitive={embedded ? undefined : "panel"}
    >
      <header className={styles.timelineHeader}>
        {embedded ? (
          <h3 className={styles.timelineCount}>
            {owner === "all" ? "All owners" : ownerName(owner)} · <span>{matching.length} people</span>
          </h3>
        ) : (
          <h2>Wait timeline</h2>
        )}
        <div className={styles.toolbar}>
          <SearchField
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(0);
            }}
            label="Filter wait timeline"
          />
          <TeamSelect
            value={owner}
            onChange={(value) => {
              setOwner(value);
              setPage(0);
            }}
          />
          {embedded ? (
            <label className={styles.selectLabel}>
              Sort
              <select
                value={sort}
                aria-label="Timeline sort"
                onChange={(event) => {
                  setSort(event.target.value as typeof sort);
                  setPage(0);
                }}
              >
                <option value="longestWait">Longest wait</option>
                <option value="triageRank">Triage</option>
              </select>
            </label>
          ) : (
            <span className={styles.sortHint}>
              Sort: <b>Longest wait</b>
              <ChevronDown aria-hidden="true" size={14} />
            </span>
          )}
          {!embedded && (
            <div className={styles.modeSwitch} role="group" aria-label="Wait display">
              <button type="button" aria-pressed={mode === "table"} onClick={() => setMode("table")}>
                <Table2 aria-hidden="true" size={16} />
                Table
              </button>
              <button type="button" aria-pressed={mode === "timeline"} onClick={() => setMode("timeline")}>
                <ChartNoAxesColumn aria-hidden="true" size={16} />
                Timeline
              </button>
            </div>
          )}
        </div>
      </header>
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
          <colgroup>
            <col className={styles.timelinePatientCol} />
            {embedded && <col className={styles.timelineTriageCol} />}
            <col />
            <col className={styles.timelineReasonCol} />
            <col className={styles.timelineOwnerCol} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">
                {embedded ? (
                  <>
                    Patient<span className={styles.secondary}>ED department</span>
                  </>
                ) : (
                  "Patient & ED"
                )}
              </th>
              {embedded && <th scope="col">Triage</th>}
              <th scope="col" className={styles.axisCell}>
                {mode === "timeline" ? (
                  <>
                    <span className={styles.elapsedHeading}>
                      Elapsed wait
                      {embedded && reviewAt < 20 && (
                        <span className={styles.compactReviewLabel}>
                          {ED_SEVERE_PRESSURE_WAIT_MINUTES / 60}h review
                        </span>
                      )}
                    </span>
                    <div className={styles.axis} aria-label={`Linear time scale, zero to ${scale / 60} hours`}>
                      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                        <span key={fraction} style={{ left: `${fraction * 100}%` }}>
                          {fraction === 0
                            ? "0h"
                            : embedded && (scale * fraction) % 60 === 0
                              ? `${(scale * fraction) / 60}h`
                              : splitDuration(scale * fraction)}
                        </span>
                      ))}
                      <span
                        className={styles.reviewLabel}
                        hidden={embedded && reviewAt < 20}
                        style={{ left: `${reviewAt}%` }}
                      >
                        {embedded
                          ? `${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60}h`
                          : splitDuration(ED_SEVERE_PRESSURE_WAIT_MINUTES)}{" "}
                        review{embedded ? "" : " marker"}
                      </span>
                    </div>
                  </>
                ) : (
                  "Time in ED / last recorded update"
                )}
              </th>
              <th scope="col">{embedded ? "Reason for wait" : "Reason for delay"}</th>
              <th scope="col">Owner{embedded && <span className={styles.secondary}>Last update</span>}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ movement, cause }) => {
              const segment = delayTimelineSegments(movement, now, scale);
              return (
                <tr key={movement.id} data-selected={movement.id === selectedId}>
                  <th scope="row">
                    <button
                      type="button"
                      className={styles.patientButton}
                      onClick={() => onSelect(movement.id)}
                      aria-label={`Inspect timeline for ${patientOf(movement).formalName}`}
                      data-testid={`delays-timeline-select-${movement.id}`}
                    >
                      {patientOf(movement).formalName} {!embedded && <Urgency movement={movement} />}
                      <span className={`${styles.secondary} ${styles.patientMeta}`}>{shortOrigin(movement)}</span>
                    </button>
                  </th>
                  {embedded && (
                    <td>
                      <Urgency movement={movement} />
                    </td>
                  )}
                  <td className={styles.trackCell}>
                    {mode === "timeline" ? (
                      <div
                        className={styles.track}
                        aria-label={`${splitDuration(segment.waiting)} waiting; ${segment.activity === undefined ? "no change recorded since arrival" : `${splitDuration(segment.quiet)} since last update`}`}
                      >
                        <span className={styles.reviewLine} style={{ left: `${reviewAt}%` }} aria-hidden="true" />
                        {(!embedded || segment.activity !== undefined) && (
                          <span
                            className={styles.trackCaption}
                            style={{ left: `${Math.min(segment.totalWidth, 80)}%` }}
                          >
                            {segment.activity === undefined
                              ? "No update recorded"
                              : `Last ${embedded ? "change" : "update"} ${recordedUpdate(movement, now)}`}
                          </span>
                        )}
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
                        <b className={styles.barDuration} style={{ left: `${segment.totalWidth}%` }}>
                          {splitDuration(segment.waiting)}
                        </b>
                      </div>
                    ) : (
                      <>
                        <b>{splitDuration(segment.waiting)}</b>
                        <span className={styles.secondary}>{recordedUpdate(movement, now)}</span>
                      </>
                    )}
                  </td>
                  <td className={styles.cause} title={causeName(cause)}>
                    {SHORT_CAUSE[cause]}
                    <LegalNote movement={movement} now={now} />
                  </td>
                  <td>
                    <OwnerBadge owner={ownerOf(cause)} />
                    {embedded && (
                      <span className={styles.secondary}>
                        {segment.activity ? `Last change ${recordedUpdate(movement, now)}` : "No update recorded"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={embedded ? 5 : 4} className={styles.empty}>
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
      {selected && (
        <div ref={inspectionRef} className={styles.timelineDetail}>
          <CompactStrip record={selected} now={now} timeline onClose={onClose} />
        </div>
      )}
      <footer className={styles.footer}>
        <div className={styles.timelineLegend}>
          <span>
            <i className={styles.solidKey} />
            Solid: time before last update
          </span>
          <span>
            <i className={styles.hatchKey} />
            Hatched: time since last recorded update
          </span>
          <span>
            <i className={styles.dotKey} />
            Dot: recorded update
          </span>
          {!embedded && (
            <span title={OPERATIONAL_DEFAULT_LABEL}>
              <i className={styles.reviewKey} />
              {embedded
                ? `${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60}h`
                : splitDuration(ED_SEVERE_PRESSURE_WAIT_MINUTES)}{" "}
              review · operational default
            </span>
          )}
        </div>
        <span aria-live="polite">
          Showing {shown.length} of {matching.length} · Synthetic records
        </span>
        <PageControls page={currentPage} pages={pages} onChange={setPage} label="timeline" />
      </footer>
    </section>
  );
}

type WorkspaceProps = {
  onLayoutChange?: (view: "focus" | "workspace") => void;
  rows: DelayRecord[];
  groups: DelayGroup[];
  now: Instant;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose?: () => void;
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
/** Both table designs share their filters, records and selection. */
export function DelaysTableWorkspace(props: WorkspaceProps) {
  const { rows, groups, now, selectedId, onSelect, detail, markLabel, isMarked } = props;
  const patientOf = usePatientOf();
  const id = useId();
  const [view, setView] = useState<"focus" | "workspace">("focus");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<DelayOwnerId | "all">("all");
  const [causeFilter, setCauseFilter] = useState<DelayCause | "all">("all");
  const [sort, setSort] = useState<Sort>("longestWait");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const filtered = rows
    .filter(
      ({ movement, cause }) =>
        `${patientOf(movement).formalName} ${movement.id} ${originName(movement)} ${causeName(cause)} ${movement.blocker}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()) &&
        (owner === "all" || ownerOf(cause) === owner) &&
        (causeFilter === "all" || cause === causeFilter),
    )
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
  const size = view === "workspace" ? 6 : pageSize;
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pages - 1);
  const shown = filtered.slice(currentPage * size, (currentPage + 1) * size);
  const selected = rows.find(({ movement }) => movement.id === selectedId);
  const clearFilters = () => {
    setQuery("");
    setOwner("all");
    setCauseFilter("all");
    setPage(0);
  };
  const changeTab = (next: typeof view) => {
    setView(next);
    props.onLayoutChange?.(next);
    setPage(0);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };
  const sortControl = (
    <label className={styles.selectLabel}>
      Sort
      <select
        value={sort}
        onChange={(event) => {
          setSort(event.target.value as Sort);
          setPage(0);
        }}
      >
        <option value="longestWait">Longest wait</option>
        <option value="worstBlocker">Worst blocker first</option>
        <option value="legalDeadline">Recorded due time</option>
        <option value="triageRank">Triage rank (T1–T3)</option>
      </select>
    </label>
  );
  return (
    <section className={styles.workspace} aria-label="Delay table layouts">
      <div className={styles.layoutHeader}>
        <h2>Waiting &amp; blockers</h2>
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
          {(
            [
              { key: "focus", label: "Focus table", number: "01" },
              { key: "workspace", label: "Action workspace", number: "02" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`${id}-tab-${tab.key}`}
              aria-controls={`${id}-panel`}
              aria-selected={view === tab.key}
              tabIndex={view === tab.key ? 0 : -1}
              onClick={() => changeTab(tab.key)}
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
        data-dossier={view === "workspace" && selected ? "open" : "closed"}
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
                setPage(0);
              }}
            >
              <Users aria-hidden="true" size={18} />
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
                  setPage(0);
                }}
              >
                <OwnerIcon owner={entry.id} />
                <span>{ownerName(entry.id)}</span>
                <strong>{rows.filter((row) => ownerOf(row.cause) === entry.id).length}</strong>
              </button>
            ))}
            <h3 className={styles.railCauseTitle}>Blocker / cause</h3>
            {groups
              .filter((group) => owner === "all" || ownerOf(group.cause) === owner)
              .map((group) => (
                <button
                  key={group.cause}
                  type="button"
                  aria-pressed={causeFilter === group.cause}
                  onClick={() => {
                    setCauseFilter(causeFilter === group.cause ? "all" : group.cause);
                    setPage(0);
                  }}
                >
                  <span>{SHORT_CAUSE[group.cause]}</span>
                  <strong>{group.movements.length}</strong>
                </button>
              ))}
          </aside>
        )}
        <section
          className={`${styles.panel} ${styles.waitingPanel}`}
          role="region"
          aria-label="Waiting"
          data-ward-primitive="panel"
        >
          <header className={styles.worklistHeader}>
            {view === "focus" ? (
              <div className={styles.markBar} role="group" aria-label="Mark">
                {[
                  { id: "waiting", label: "All", count: rows.length },
                  {
                    id: "locked",
                    label: "Locked bed",
                    count: rows.filter(({ movement }) => movement.security === "Secure").length,
                  },
                  {
                    id: "escalated",
                    label: "Escalated",
                    count: rows.filter(({ movement }) => movement.escalation !== undefined).length,
                  },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    aria-pressed={props.delayFilterId === filter.id}
                    aria-label={`${filter.id === "waiting" ? "People waiting" : filter.id === "locked" ? "Needs a locked bed" : "Escalated"} ${filter.count}`}
                    onClick={() => props.onMarkFilter(filter.id)}
                  >
                    {filter.label}
                    <b {...(filter.id === "waiting" && markLabel === null ? { "data-ward-panel-count": true } : {})}>
                      {filter.count}
                    </b>
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.queueHeading}>
                <h2>
                  {owner === "all" ? "All teams" : ownerName(owner)} · {filtered.length} people
                </h2>
                <p>
                  People waiting where {owner === "all" ? "a team is" : `${ownerName(owner)} are`} the next responsible
                  team.
                </p>
              </div>
            )}
            <div className={styles.toolbar}>
              <SearchField
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setPage(0);
                }}
                label="Filter patient worklist"
              />
              {view === "focus" && (
                <>
                  <TeamSelect
                    value={owner}
                    onChange={(value) => {
                      setOwner(value);
                      setPage(0);
                    }}
                  />
                  <label className={styles.selectLabel}>
                    Cause
                    <select
                      value={causeFilter}
                      onChange={(event) => {
                        setCauseFilter(event.target.value as typeof causeFilter);
                        setPage(0);
                      }}
                    >
                      <option value="all">All</option>
                      {groups.map((group) => (
                        <option key={group.cause} value={group.cause}>
                          {SHORT_CAUSE[group.cause]}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {sortControl}
            </div>
          </header>
          {(markLabel !== null || query !== "" || owner !== "all" || causeFilter !== "all") && (
            <div className={styles.filterNote}>
              <span data-ward-panel-count={markLabel !== null || view === "focus" ? true : undefined}>
                {markLabel !== null
                  ? `${props.markedCount} of ${rows.length} marked · ${markLabel}`
                  : `${filtered.length} matching people`}
              </span>
              {(query !== "" || owner !== "all" || causeFilter !== "all") && (
                <button type="button" className={styles.textButton} onClick={clearFilters}>
                  Clear table filters
                </button>
              )}
            </div>
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
                  {view === "focus" && (
                    <th scope="col">
                      <span className="sr-only">Selection</span>
                    </th>
                  )}
                  <th scope="col">{view === "focus" ? "Patient" : "Name"}</th>
                  {view === "workspace" && <th scope="col">Urgency</th>}
                  <th scope="col" className={styles.fromColumn}>
                    {view === "focus" ? "From" : "From (ED)"}
                  </th>
                  <th scope="col">{view === "focus" ? "ED wait" : "Waiting ↓"}</th>
                  {view === "focus" && <th scope="col">Urgency</th>}
                  <th scope="col">{view === "focus" ? "Blocker" : "Blocker / cause"}</th>
                  {view === "focus" && (
                    <th scope="col" className={styles.ownerColumn}>
                      Responsible team
                    </th>
                  )}
                  <th scope="col">{view === "focus" ? "Last recorded update" : "Last update"}</th>
                  <th scope="col">{view === "focus" ? "Open" : <span className="sr-only">Open movement</span>}</th>
                </tr>
              </thead>
              <tbody data-testid="delays-waiting-list" data-ward-primitive="list" onKeyDown={props.onListKeyDown}>
                {shown.map(({ movement, cause }) => {
                  const patient = patientOf(movement);
                  const active = movement.id === selectedId;
                  return (
                    <Fragment key={movement.id}>
                      <tr data-selected={active} data-dimmed={markLabel !== null && !isMarked(movement, cause)}>
                        {view === "focus" && (
                          <td className={styles.checkboxCell}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${patient.formalName}`}
                              checked={active}
                              onChange={() => (active ? props.onClose?.() : onSelect(movement.id))}
                            />
                          </td>
                        )}
                        <th scope="row">
                          <button
                            type="button"
                            className={styles.patientButton}
                            aria-label={`Select patient ${patient.displayName}`}
                            aria-pressed={active}
                            onClick={() => onSelect(movement.id)}
                            data-testid={`delays-select-${movement.id}`}
                            data-ward-primitive="record-row"
                            data-record-key={movement.id}
                            data-owner={ownerOf(cause)}
                            data-severe={SEVERE_CAUSES.includes(cause)}
                          >
                            <span data-ward-primitive="record-id">{patient.formalName}</span>
                            {markLabel !== null && isMarked(movement, cause) && (
                              <span className="sr-only">Marked: {markLabel}</span>
                            )}
                            {view === "focus" && (
                              <span
                                className={`${styles.profile} ${styles.patientMeta}`}
                                data-ward-type-floor="delays-profile"
                              >
                                {patient.umrn}
                                {patient.patient?.sex ? ` · ${patient.patient.sex}` : ""}
                              </span>
                            )}
                          </button>
                        </th>
                        {view === "workspace" && (
                          <td>
                            <Urgency movement={movement} />
                          </td>
                        )}
                        <td className={styles.fromColumn} title={originName(movement)}>
                          {shortOrigin(movement)}
                        </td>
                        <td
                          className={styles.wait}
                          data-ward-type-floor="delays-wait"
                          data-long={now - movement.openedAt >= ED_SEVERE_PRESSURE_WAIT_MINUTES}
                        >
                          {splitDuration(Math.max(0, now - movement.openedAt))}
                        </td>
                        {view === "focus" && (
                          <td>
                            <Urgency movement={movement} />
                          </td>
                        )}
                        <td className={styles.cause} data-ward-type-floor="delays-cause" title={causeName(cause)}>
                          {SHORT_CAUSE[cause]}
                          <LegalNote movement={movement} now={now} />
                        </td>
                        {view === "focus" && (
                          <td className={styles.ownerColumn}>
                            <OwnerBadge owner={ownerOf(cause)} />
                          </td>
                        )}
                        <td>
                          <span
                            className={styles.update}
                            data-ward-type-floor="delays-since"
                            data-recorded={recordedUpdate(movement, now) !== "No update recorded"}
                          >
                            {recordedUpdate(movement, now)}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.openLink}
                            aria-label={`Inspect ${patient.formalName}`}
                            onClick={() => (active ? props.onClose?.() : onSelect(movement.id))}
                          >
                            {active ? (
                              <ChevronDown aria-hidden="true" size={18} />
                            ) : (
                              <ChevronRight aria-hidden="true" size={18} />
                            )}
                          </button>
                        </td>
                      </tr>
                      {active && view === "focus" && (
                        <tr className={styles.detailRow}>
                          <td colSpan={9}>
                            <CompactStrip record={{ movement, cause }} now={now} onClose={props.onClose} />
                            <details
                              className={styles.moreTools}
                              onToggle={(event) => {
                                if (!event.currentTarget.open || !window.matchMedia("(max-width: 1099px)").matches)
                                  return;
                                event.currentTarget
                                  .querySelector<HTMLElement>('[aria-label="Extended patient delay details"]')
                                  ?.focus({ preventScroll: true });
                              }}
                            >
                              <summary>Patient actions and full details</summary>
                              {detail}
                            </details>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={view === "focus" ? 9 : 7} className={styles.empty} data-testid="delays-empty-state">
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
          <footer className={styles.footer}>
            <span aria-live="polite">
              Showing {shown.length} of {filtered.length} · Synthetic records
            </span>
            {view === "focus" && (
              <label className={styles.rowsPerPage}>
                Rows per page
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(0);
                  }}
                >
                  {[6, 10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <PageControls page={currentPage} pages={pages} onChange={setPage} label="waiting" />
          </footer>
        </section>
        {view === "workspace" && selected && (
          <PatientDossier record={selected} now={now} onClose={props.onClose} detail={detail} />
        )}
      </div>
      {view === "focus" && selected && !shown.some(({ movement }) => movement.id === selectedId) && (
        <CompactStrip record={selected} now={now} onClose={props.onClose} />
      )}
      <section
        className={`${styles.panel} ${styles.blockerPanel}`}
        role="region"
        aria-label="What the blocker is"
        data-ward-primitive="panel"
      >
        <details open={view === "focus" ? undefined : true}>
          <summary>
            <FileText aria-hidden="true" size={18} />
            <h2>What the blocker is</h2>
            <span>
              {rows.length} waiting · {groups.length} causes
            </span>
            <ChevronDown aria-hidden="true" size={16} />
          </summary>
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Blocker groups">
            <table className={`${styles.table} ${styles.blockerTable}`}>
              <caption className="sr-only">
                One worst blocker per waiting person in the current service scope. Select a cause to mark matching
                people.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Blocker</th>
                  <th scope="col">Responsible team</th>
                  <th scope="col" className={styles.numeric}>
                    Waiting
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.cause}>
                    <th scope="row">
                      <button
                        type="button"
                        className={styles.causeButton}
                        data-testid={`delays-cause-${group.cause}`}
                        aria-pressed={props.markedCause === group.cause}
                        data-severe={SEVERE_CAUSES.includes(group.cause)}
                        onClick={() => props.onMarkCause(group.cause)}
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
        </details>
      </section>
    </section>
  );
}
