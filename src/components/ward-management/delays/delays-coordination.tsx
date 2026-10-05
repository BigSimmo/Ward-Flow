"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  ChevronRight,
  Clock,
  Hospital,
  Info,
  RotateCcw,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { formatInstantWithDay, splitDuration, type Instant } from "../ward-clock";
import { usePatientOf } from "../ward-patient-name";
import { departmentLabel } from "../ward-absence-labels";
import { edById } from "../ward-sites";
import { legalFormName } from "../ward-legal-forms";
import {
  DUE_SOON_MINUTES,
  DUE_SOON_URGENT_MINUTES,
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "../ward-operational-defaults";
import {
  DELAY_OWNERS,
  SEVERE_CAUSES,
  lastRecordedActivity,
  legalDeadlineMinutes,
  ownerOf,
  type DelayOwnerId,
} from "./delays-derivations";
import {
  delayCatchments,
  delayRadarGroups,
  type CatchmentOrigin,
  type DelayRecord,
  type RadarBand,
} from "./delays-view-model";
import { DelaysWaitTimeline } from "./delays-data-views";
import styles from "./delays-coordination.module.css";

export type DelayQueueScope = { owner: DelayOwnerId } | { origin: CatchmentOrigin };
type Props = {
  markedOwner?: DelayOwnerId | null;
  onMarkOwner?: (owner: DelayOwnerId) => void;
  rows: DelayRecord[];
  now: Instant;
  onViewQueue: (scope: DelayQueueScope) => void;
};
type Graph = "catchment" | "radar" | "timeline";
const GRAPHS: { id: Graph; label: string; title: string; subtitle: string }[] = [
  {
    id: "catchment",
    label: "Catchment Pressure",
    title: "Catchment pressure",
    subtitle: "People waiting by origin catchment · current snapshot",
  },
  { id: "radar", label: "Crisis Radar", title: "Crisis radar", subtitle: "Recorded legal attention and ED wait" },
  { id: "timeline", label: "Wait Timeline", title: "Wait timeline", subtitle: "Elapsed wait and last recorded change" },
];
const CATCHMENTS: Record<CatchmentOrigin, { short: string; full: string; code: string }> = {
  "North Metro": { short: "North Metro", full: "North Metropolitan", code: "NMHS" },
  "East Metro": { short: "East Metro", full: "East Metropolitan", code: "EMHS" },
  "South Metro": { short: "South Metro", full: "South Metropolitan", code: "SMHS" },
  WACHS: { short: "WA Country", full: "WA Country", code: "WACHS" },
  CAHS: { short: "Child & Adolescent", full: "Child and Adolescent Health Service", code: "CAHS" },
  Private: { short: "Private", full: "Private services", code: "Private" },
  unrecorded: { short: "Unrecorded origin", full: "Unrecorded origin", code: "" },
};
export function delayQueueLabel(scope: DelayQueueScope) {
  return "owner" in scope ? teamName(scope.owner) : CATCHMENTS[scope.origin].full;
}
function dueDuration(minutes: number) {
  return minutes <= 120 ? `${minutes}m` : splitDuration(minutes);
}
function teamName(owner: DelayOwnerId) {
  return owner === "yours" ? "Coordinator" : (DELAY_OWNERS.find((entry) => entry.id === owner)?.name ?? owner);
}
function originName(record: DelayRecord) {
  return departmentLabel(record.movement.originEdId, edById(record.movement.originEdId)?.name)
    .replace(/ Emergency Department$/u, " ED")
    .replace(/^St John of God /u, "")
    .replace(/ (?:General Hospital|Hospital|Health Campus)(?= ED$)/u, "");
}
function OwnerSelect({
  value,
  onChange,
  label,
}: {
  value: DelayOwnerId | "all";
  onChange: (owner: DelayOwnerId | "all") => void;
  label: string;
}) {
  return (
    <label className={styles.ownerField}>
      Owner
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as typeof value)}>
        <option value="all">All</option>
        {DELAY_OWNERS.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {teamName(owner.id)}
          </option>
        ))}
      </select>
    </label>
  );
}
function Key({ amber = false, children }: { amber?: boolean; children: React.ReactNode }) {
  return (
    <span className={styles.key}>
      <i data-amber={amber} />
      {children}
    </span>
  );
}
function Close({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className={styles.close} onClick={onClick} aria-label={label}>
      <X size={19} aria-hidden="true" />
    </button>
  );
}
function MovementAction({ record, children = "Review movement" }: { record: DelayRecord; children?: React.ReactNode }) {
  return (
    <Link className={styles.movementAction} href={`/mockups/ward-flow/movements/${record.movement.id}`}>
      {children}
      <ArrowRight size={17} aria-hidden="true" />
    </Link>
  );
}
function ActionRunway({ rows, now, onViewQueue, markedOwner, onMarkOwner }: Props) {
  const patientOf = usePatientOf();
  const past = rows.filter(({ movement }) => (legalDeadlineMinutes(movement, now) ?? Infinity) < 0);
  const imminent = rows.filter(({ movement }) => {
    const due = legalDeadlineMinutes(movement, now);
    return due !== undefined && due >= 0 && due <= DUE_SOON_URGENT_MINUTES;
  });
  const attention = [...past, ...imminent].sort(
    (a, b) => (legalDeadlineMinutes(a.movement, now) ?? Infinity) - (legalDeadlineMinutes(b.movement, now) ?? Infinity),
  );
  const descriptions: Record<DelayOwnerId, string> = {
    yours: "Bed match or decision",
    wards: "Ward response or readiness",
    ed: "Referring department",
    transport: "Vehicle or escort",
    other: "Review external hold",
  };
  const icons = { yours: Users, wards: BedDouble, ed: Hospital, transport: Truck, other: UserRound };
  const bands = [
    {
      label: `Under ${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60}h`,
      count: rows.filter(({ movement }) => now - movement.openedAt < ED_SEVERE_PRESSURE_WAIT_MINUTES).length,
    },
    {
      label: `${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60} – ${LONG_WAIT_MINUTES / 60}h`,
      count: rows.filter(
        ({ movement }) =>
          now - movement.openedAt >= ED_SEVERE_PRESSURE_WAIT_MINUTES && now - movement.openedAt < LONG_WAIT_MINUTES,
      ).length,
    },
    {
      label: `Over ${LONG_WAIT_MINUTES / 60}h`,
      count: rows.filter(({ movement }) => now - movement.openedAt >= LONG_WAIT_MINUTES).length,
    },
  ];
  return (
    <section className={styles.runway} aria-label="Action runway" data-ward-primitive="panel">
      <header className={styles.runwayHeader}>
        <h2>
          <Clock size={20} aria-hidden="true" />
          Action runway
        </h2>
        <span className={styles.attentionSummary} data-past={past.length > 0}>
          <Clock size={14} aria-hidden="true" />
          {past.length} past recorded time · {imminent.length} due within 60m
        </span>
      </header>
      {attention.map((record) => {
        const due = legalDeadlineMinutes(record.movement, now)!;
        return (
          <div className={styles.urgentRow} data-past={due < 0} key={record.movement.id}>
            <Clock size={25} aria-hidden="true" />
            <div className={styles.urgentPerson}>
              <strong>{patientOf(record.movement).displayName}</strong>
              <span>
                {originName(record)} ·{" "}
                {record.movement.legalForm ? legalFormName(record.movement.legalForm) : "No form recorded"}
              </span>
            </div>
            <b className={styles.urgentTime}>
              {due < 0 ? `Past recorded time by ${splitDuration(-due)}` : `Due in ${dueDuration(due)}`}
              <span> · ED wait {splitDuration(Math.max(0, now - record.movement.openedAt))}</span>
            </b>
            <MovementAction record={record}>Review</MovementAction>
          </div>
        );
      })}
      {attention.length === 0 && (
        <p className={styles.noAttention}>No recorded due times requiring attention within 60m.</p>
      )}
      <div className={styles.ownerGrid}>
        {DELAY_OWNERS.map((owner) => {
          const records = rows.filter(({ cause }) => ownerOf(cause) === owner.id);
          const severe = records.filter(({ cause }) => SEVERE_CAUSES.includes(cause)).length;
          const Icon = icons[owner.id];
          return (
            <div className={styles.ownerCard} key={owner.id}>
              <Icon size={23} aria-hidden="true" />
              <div>
                <button
                  type="button"
                  className={styles.ownerMark}
                  data-testid={`delays-owner-${owner.id}`}
                  aria-label={`Mark ${teamName(owner.id)} waiting records`}
                  aria-pressed={markedOwner === owner.id}
                  onClick={() => onMarkOwner?.(owner.id)}
                >
                  <strong>{teamName(owner.id)}</strong>
                  <b>{records.length}</b>
                </button>
                {severe > 0 && (
                  <span className={styles.critical}>
                    <i />
                    {severe} critical blocker{severe === 1 ? "" : "s"}
                  </span>
                )}
                <p>{records.length === 0 ? "No waiting records" : descriptions[owner.id]}</p>
                {records.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onViewQueue({ owner: owner.id })}
                    aria-label={`View ${teamName(owner.id)} queue`}
                  >
                    View queue
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.waitDistribution}>
        <strong>Emergency Department wait durations:</strong>
        <div>
          <div
            className={styles.distributionBar}
            role="img"
            aria-label={bands.map((band) => `${band.label}: ${band.count}`).join("; ")}
          >
            {bands.map((band, index) => (
              <span
                key={band.label}
                data-band={index}
                style={{ width: `${rows.length ? (band.count / rows.length) * 100 : 0}%` }}
              />
            ))}
          </div>
          <div className={styles.distributionLegend}>
            {bands.map((band, index) => (
              <span key={band.label}>
                <i data-band={index} />
                {band.label}: <b>{band.count}</b> ({rows.length ? Math.round((band.count / rows.length) * 100) : 0}%)
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CatchmentPressure({ rows, now, onViewQueue }: Props) {
  const [owner, setOwner] = useState<DelayOwnerId | "all">("all");
  const [selected, setSelected] = useState<CatchmentOrigin | null>(null);
  const returnFocus = useRef<SVGGElement | null>(null);
  const close = () => {
    setSelected(null);
    returnFocus.current?.focus();
  };
  const id = useId().replace(/:/g, "");
  const filtered = rows.filter(({ cause }) => owner === "all" || ownerOf(cause) === owner);
  const stats = delayCatchments(filtered, now);
  const max = Math.max(4, ...stats.map((entry) => entry.total));
  const step = max <= 40 ? Math.max(1, Math.ceil(max / 4 / 5) * 5) : Math.ceil(max / 4 / 10) * 10;
  const ceiling = step * 4;
  const choice = stats.find((entry) => entry.origin === selected);
  function renderGraph(mobile: boolean) {
    const width = mobile ? Math.max(400, stats.length * 85) : 1100;
    const height = mobile ? 290 : 310;
    const left = mobile ? 38 : 75,
      right = mobile ? 24 : 70,
      top = 40,
      bottom = height - 60;
    const x = (index: number) => left + (index / Math.max(1, stats.length - 1)) * (width - left - right);
    const y = (value: number) => bottom - (value / ceiling) * (bottom - top);
    const totalPath = stats.map((entry, index) => `${index ? "L" : "M"}${x(index)},${y(entry.total)}`).join(" ");
    const longPath = stats.map((entry, index) => `${index ? "L" : "M"}${x(index)},${y(entry.over8)}`).join(" ");
    return (
      <svg
        className={mobile ? styles.mobilePressure : styles.desktopPressure}
        viewBox={`0 0 ${width} ${height}`}
        aria-label={`People waiting by origin catchment. ${stats.map((entry) => `${CATCHMENTS[entry.origin].short}: ${entry.total} waiting, ${entry.over8} over ${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60} hours`).join("; ")}`}
        role="group"
      >
        <defs>
          <linearGradient id={`${id}-${mobile}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b6daf6" stopOpacity=".72" />
            <stop offset="100%" stopColor="#deedf8" stopOpacity=".22" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((tick) => (
          <g key={tick}>
            <line
              x1={left - 8}
              x2={width - right + 15}
              y1={y(tick * step)}
              y2={y(tick * step)}
              className={styles.gridLine}
            />
            <text x={left - 19} y={y(tick * step) + 4} textAnchor="end" className={styles.axisText}>
              {tick * step}
            </text>
          </g>
        ))}
        {!mobile && (
          <text
            transform={`translate(17 ${top + (bottom - top) / 2}) rotate(-90)`}
            textAnchor="middle"
            className={styles.axisText}
          >
            People waiting
          </text>
        )}
        {stats.map((entry, index) => (
          <line key={entry.origin} x1={x(index)} x2={x(index)} y1={top} y2={bottom} className={styles.gridLine} />
        ))}
        {choice && (
          <rect
            x={x(stats.indexOf(choice)) - (mobile ? 16 : 42)}
            y={top}
            width={mobile ? 32 : 84}
            height={bottom - top}
            fill="#dcecfa"
            opacity=".5"
          />
        )}
        <path
          d={`${totalPath} L${x(stats.length - 1)},${bottom} L${x(0)},${bottom} Z`}
          fill={`url(#${id}-${mobile}-fill)`}
        />
        <line x1={left - 8} x2={width - right + 15} y1={bottom} y2={bottom} className={styles.baseline} />
        <path d={totalPath} className={styles.totalLine} />
        <path d={longPath} className={styles.longLine} />
        {stats.map((entry, index) => (
          <g
            key={entry.origin}
            role="button"
            tabIndex={0}
            aria-label={`Inspect ${CATCHMENTS[entry.origin].full}: ${entry.total} waiting`}
            aria-pressed={selected === entry.origin}
            onClick={(event) => {
              returnFocus.current = event.currentTarget;
              setSelected(entry.origin);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                returnFocus.current = event.currentTarget;
                setSelected(entry.origin);
              }
            }}
          >
            <rect
              x={x(index) - (mobile ? 34 : 58)}
              y={top - 16}
              width={mobile ? 68 : 116}
              height={height - top + 8}
              fill="transparent"
            />
            <circle cx={x(index)} cy={y(entry.total)} r={6} className={styles.totalPoint} />
            <circle cx={x(index)} cy={y(entry.over8)} r={6} className={styles.longPoint} />
            <text
              x={x(index)}
              y={y(entry.total) - (entry.total === entry.over8 ? 27 : 15)}
              textAnchor="middle"
              className={styles.totalLabel}
            >
              {entry.total}
            </text>
            <text x={x(index)} y={y(entry.over8) - 13} textAnchor="middle" className={styles.longLabel}>
              {entry.over8}
            </text>
            <text x={x(index)} y={bottom + 28} textAnchor="middle" className={styles.axisText}>
              {CATCHMENTS[entry.origin].short}
              {mobile ? (
                <tspan x={x(index)} dy="17">
                  {CATCHMENTS[entry.origin].code}
                </tspan>
              ) : (
                ` (${CATCHMENTS[entry.origin].code})`
              )}
            </text>
          </g>
        ))}
        {choice && (
          <g className={styles.chartCallout}>
            <rect
              x={x(stats.indexOf(choice)) - 65}
              y={Math.max(0, y(choice.total) - 55)}
              width={130}
              height={25}
              rx={4}
            />
            <text x={x(stats.indexOf(choice))} y={Math.max(0, y(choice.total) - 55) + 17} textAnchor="middle">
              {choice.total} of {filtered.length} waiting
            </text>
          </g>
        )}
      </svg>
    );
  }
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "Escape" && selected !== null) {
          event.preventDefault();
          close();
        }
      }}
    >
      <div className={styles.pressureToolbar}>
        <OwnerSelect
          value={owner}
          onChange={(value) => {
            setOwner(value);
            setSelected(null);
          }}
          label="Catchment pressure owner"
        />
        <span className={styles.snapshot}>
          <Clock size={19} aria-hidden="true" />
          Snapshot {formatInstantWithDay(now, now)} AWST
        </span>
        <div className={styles.keys}>
          <Key>Waiting (total)</Key>
          <Key amber>Over {ED_SEVERE_PRESSURE_WAIT_MINUTES / 60}h</Key>
        </div>
      </div>
      <div className={styles.pressurePlot}>
        {renderGraph(false)}
        {renderGraph(true)}
      </div>
      {choice && (
        <div
          className={styles.catchmentInspector}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSelected(null);
          }}
        >
          <div>
            <strong>
              {CATCHMENTS[choice.origin].full} <span>({CATCHMENTS[choice.origin].code})</span>
            </strong>
            <small>Selected catchment</small>
          </div>
          <div>
            <b>{choice.total}</b>
            <small>waiting</small>
          </div>
          <div data-amber>
            <b>{choice.over8}</b>
            <small>over {ED_SEVERE_PRESSURE_WAIT_MINUTES / 60}h</small>
          </div>
          <div data-amber>
            <b>{choice.over24}</b>
            <small>over {LONG_WAIT_MINUTES / 60}h</small>
          </div>
          <button type="button" className={styles.primary} onClick={() => onViewQueue({ origin: choice.origin })}>
            View {choice.total} people
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <Close onClick={close} label="Close catchment details" />
        </div>
      )}
      <footer className={styles.chartFooter}>
        <span>
          <Info size={17} aria-hidden="true" />
          Counted once by origin ED.
        </span>
        <span>Snapshot {formatInstantWithDay(now, now)} AWST · Synthetic records</span>
      </footer>
    </div>
  );
}

const LANES: Record<RadarBand, string> = {
  breached: "Past recorded time",
  imminent: "Due within 60m",
  severe: `Due ${DUE_SOON_URGENT_MINUTES / 60}–${DUE_SOON_MINUTES / 60}h or T1 without deadline`,
  routine: "Other waiting",
};
function RadarInspector({ record, now, onClose }: { record: DelayRecord; now: Instant; onClose: () => void }) {
  const patientOf = usePatientOf();
  const { movement, cause } = record;
  const due = legalDeadlineMinutes(movement, now);
  const latest = lastRecordedActivity(movement, now);
  const activity = latest?.what === "the journey opened" ? undefined : latest;
  return (
    <aside className={styles.radarInspector} aria-label="Selected radar patient" tabIndex={-1}>
      <header>
        <div>
          <h3>{patientOf(movement).displayName}</h3>
          <span>Synthetic patient</span>
        </div>
        <Close onClick={onClose} label="Close radar details" />
      </header>
      <dl>
        <div>
          <dt>From</dt>
          <dd>{originName(record)}</dd>
        </div>
        <div>
          <dt>Triage</dt>
          <dd>
            <span className={styles.triage} data-tier={movement.urgency}>
              T{movement.urgency}
            </span>
          </dd>
        </div>
        <div>
          <dt>ED wait</dt>
          <dd>
            <b>{splitDuration(Math.max(0, now - movement.openedAt))}</b>
          </dd>
        </div>
        <div>
          <dt>Document</dt>
          <dd>{movement.legalForm ? legalFormName(movement.legalForm) : "No form recorded"}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd className={styles.due} data-past={due !== undefined && due < 0}>
            {due === undefined
              ? "No due time recorded"
              : due < 0
                ? `Past recorded time by ${splitDuration(-due)}`
                : `Due in ${dueDuration(due)}`}
          </dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>
            <b>{teamName(ownerOf(cause))}</b>
          </dd>
        </div>
        <div>
          <dt>Last recorded change</dt>
          <dd>
            {activity
              ? `${splitDuration(Math.max(0, now - activity.at))} ago · ${activity.what}`
              : "No update recorded"}
          </dd>
        </div>
      </dl>
      <MovementAction record={record} />
    </aside>
  );
}
function CrisisRadar({ rows, now }: Pick<Props, "rows" | "now">) {
  const patientOf = usePatientOf();
  const [owner, setOwner] = useState<DelayOwnerId | "all">("all");
  const [windowMinutes, setWindowMinutes] = useState(LONG_WAIT_MINUTES);
  const [selectedId, setSelectedId] = useState<string | null | undefined>();
  const [cluster, setCluster] = useState<{ label: string; ids: string[] } | null>(null);
  const focusReturn = useRef<HTMLElement | null>(null);
  const filtered = rows.filter(({ cause }) => owner === "all" || ownerOf(cause) === owner);
  const graph = delayRadarGroups(filtered, now, windowMinutes);
  const suggested =
    graph.lanes.find((lane) => lane.band === "breached")?.all[0] ??
    graph.lanes.find((lane) => lane.band === "imminent")?.all[0];
  const selected = filtered.find(
    ({ movement }) => movement.id === (selectedId === undefined ? suggested?.movement.id : selectedId),
  );
  const close = () => {
    setSelectedId(null);
    setCluster(null);
    focusReturn.current?.focus();
  };
  const pick = (record: DelayRecord, target: HTMLElement) => {
    if (cluster === null) focusReturn.current = target;
    setSelectedId(record.movement.id);
    setCluster(null);
  };
  const ticks = Array.from({ length: windowMinutes / graph.interval + 1 }, (_, index) => index * graph.interval);
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "Escape" && (selected || cluster)) {
          event.preventDefault();
          close();
        }
      }}
    >
      <div className={styles.radarToolbar}>
        <div className={styles.radarTotal}>
          <Users size={28} aria-hidden="true" />
          <div>
            <b>{filtered.length}</b>
            <span>waiting</span>
          </div>
        </div>
        <OwnerSelect
          value={owner}
          onChange={(value) => {
            setOwner(value);
            setSelectedId(undefined);
            setCluster(null);
          }}
          label="Crisis radar owner"
        />
        <label className={styles.ownerField}>
          Time window
          <select
            value={windowMinutes}
            aria-label="Radar time window"
            onChange={(event) => {
              setWindowMinutes(Number(event.target.value));
              setCluster(null);
            }}
          >
            {[LONG_WAIT_MINUTES, LONG_WAIT_MINUTES * 2].map((minutes) => (
              <option key={minutes} value={minutes}>
                0 – {minutes / 60}h
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            setOwner("all");
            setWindowMinutes(1440);
            setSelectedId(undefined);
            setCluster(null);
          }}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Reset view
        </button>
      </div>
      <div className={styles.radarBody} data-inspector={!!selected || !!cluster}>
        <div className={styles.radarChart}>
          <div className={styles.radarLabels}>
            {graph.lanes.map((lane) => (
              <div key={lane.band}>
                <strong>{LANES[lane.band]}</strong>
                <b>{lane.all.length}</b>
                {lane.all.length === 0 ? (
                  <small>None recorded</small>
                ) : lane.inView.length !== lane.all.length ? (
                  <small>({lane.inView.length} in view)</small>
                ) : null}
              </div>
            ))}
          </div>
          <div
            className={styles.radarPlot}
            style={{ "--radar-columns": windowMinutes / graph.interval } as React.CSSProperties}
            aria-label="Recorded attention by elapsed ED wait"
          >
            <span className={styles.groupNote}>Grouped in {graph.interval / 60}h windows</span>
            <div
              className={styles.radarReview}
              style={{ left: `${(ED_SEVERE_PRESSURE_WAIT_MINUTES / windowMinutes) * 100}%` }}
            >
              <span title={OPERATIONAL_DEFAULT_LABEL}>{ED_SEVERE_PRESSURE_WAIT_MINUTES / 60}h review</span>
            </div>
            {graph.lanes.map((lane) => (
              <div className={styles.radarLane} key={lane.band} data-band={lane.band}>
                {lane.band === "breached" || lane.band === "imminent"
                  ? lane.inView.map((record) => (
                      <button
                        type="button"
                        key={record.movement.id}
                        className={styles.urgentPoint}
                        data-past={lane.band === "breached"}
                        style={{ left: `${(Math.max(0, now - record.movement.openedAt) / windowMinutes) * 100}%` }}
                        aria-label={`Inspect ${patientOf(record.movement).displayName}`}
                        onClick={(event) => pick(record, event.currentTarget)}
                      >
                        <i />
                        <span>{patientOf(record.movement).displayName}</span>
                      </button>
                    ))
                  : lane.bins.map((bin) => (
                      <button
                        type="button"
                        key={bin.start}
                        className={styles.cluster}
                        style={{ left: `${((bin.start + bin.end) / 2 / windowMinutes) * 100}%` }}
                        aria-label={`${bin.people.length} people, ${LANES[lane.band]}, ${bin.start / 60} to ${bin.end / 60} hours; inspect interval`}
                        onClick={(event) => {
                          focusReturn.current = event.currentTarget;
                          setSelectedId(null);
                          setCluster({
                            label: `${LANES[lane.band]} · ${bin.start / 60}–${bin.end / 60}h`,
                            ids: bin.people.map(({ movement }) => movement.id),
                          });
                        }}
                      >
                        {bin.people.length}
                      </button>
                    ))}
              </div>
            ))}
            <div className={styles.radarAxis}>
              {ticks.map((tick) => (
                <span key={tick} style={{ left: `${(tick / windowMinutes) * 100}%` }}>
                  {tick / 60}h
                </span>
              ))}
              <span className={styles.axisTitle}>Time waiting in ED</span>
            </div>
          </div>
        </div>
        {selected && <RadarInspector record={selected} now={now} onClose={close} />}
        {cluster && (
          <aside className={styles.radarInspector} aria-label="Selected radar interval">
            <header>
              <h3>{cluster.label}</h3>
              <Close onClick={close} label="Close interval details" />
            </header>
            <p>{cluster.ids.length} people in this interval</p>
            <div className={styles.clusterPeople}>
              {filtered
                .filter(({ movement }) => cluster.ids.includes(movement.id))
                .map((record) => (
                  <button key={record.movement.id} type="button" onClick={(event) => pick(record, event.currentTarget)}>
                    <strong>{patientOf(record.movement).formalName}</strong>
                    <span>
                      {originName(record)} · {splitDuration(Math.max(0, now - record.movement.openedAt))}
                    </span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                ))}
            </div>
          </aside>
        )}
      </div>
      <section className={styles.outliers} aria-label="Long waits beyond radar window">
        <h3>
          Beyond {windowMinutes / 60}h · {graph.beyond.length} people
        </h3>
        <div>
          {graph.beyond.map((record) => (
            <button key={record.movement.id} type="button" onClick={(event) => pick(record, event.currentTarget)}>
              <UserRound size={21} aria-hidden="true" />
              <span>
                <strong>{patientOf(record.movement).formalName}</strong>
                <b>{splitDuration(Math.max(0, now - record.movement.openedAt))}</b>
              </span>
              <ChevronRight size={19} aria-hidden="true" />
            </button>
          ))}
          {graph.beyond.length === 0 && <p>No waiting records beyond this window.</p>}
        </div>
      </section>
      <footer className={styles.chartFooter}>
        <span>
          {graph.visible.length} people in the 0 – {windowMinutes / 60}h window · {graph.beyond.length} beyond{" "}
          {windowMinutes / 60}h
        </span>
        <span>Numbered circles: people in interval · Select to inspect</span>
        <div className={styles.keys}>
          <Key>Waiting</Key>
          <Key amber>Recorded due within 60m</Key>
        </div>
      </footer>
    </div>
  );
}
export function DelaysCoordination(props: Props) {
  const [graph, setGraph] = useState<Graph>("catchment");
  const [visited, setVisited] = useState<Graph[]>(["catchment"]);
  const [timelineId, setTimelineId] = useState<string | null>(null);
  const id = useId();
  const current = GRAPHS.find((entry) => entry.id === graph)!;
  function selectGraph(next: Graph) {
    setGraph(next);
    setVisited((previous) => (previous.includes(next) ? previous : [...previous, next]));
  }
  function tabKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = GRAPHS.findIndex((entry) => entry.id === graph);
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : 2)) % 3;
    selectGraph(GRAPHS[next].id);
    document.getElementById(`${id}-${GRAPHS[next].id}`)?.focus();
  }
  return (
    <div className={styles.coordination}>
      <ActionRunway {...props} />
      <section className={styles.graphPanel} aria-label="Delay graphs" data-ward-primitive="panel">
        <header className={styles.graphHeader}>
          <div>
            <h2>{current.title}</h2>
            <p>{current.subtitle}</p>
          </div>
          <div className={styles.graphTabs} role="tablist" aria-label="Delay graph" onKeyDown={tabKeys}>
            {GRAPHS.map((entry) => (
              <button
                type="button"
                role="tab"
                key={entry.id}
                id={`${id}-${entry.id}`}
                aria-selected={graph === entry.id}
                aria-controls={`${id}-graph-panel`}
                tabIndex={graph === entry.id ? 0 : -1}
                onClick={() => selectGraph(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </header>
        <div role="tabpanel" id={`${id}-graph-panel`} aria-labelledby={`${id}-${graph}`}>
          <div hidden={graph !== "catchment"}>{visited.includes("catchment") && <CatchmentPressure {...props} />}</div>
          <div hidden={graph !== "radar"}>
            {visited.includes("radar") && <CrisisRadar rows={props.rows} now={props.now} />}
          </div>
          <div hidden={graph !== "timeline"}>
            {visited.includes("timeline") && (
              <DelaysWaitTimeline
                rows={props.rows}
                now={props.now}
                embedded
                selectedId={timelineId}
                onSelect={(value) => setTimelineId(value === timelineId ? null : value)}
                onClose={() => setTimelineId(null)}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
