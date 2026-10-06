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
import { edHealthService } from "../ward-service-scope";
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
  delayRadarBand,
  delayRadarGroups,
  overTwelveHoursMinutes,
  type CatchmentOrigin,
  type DelayRecord,
  type RadarBand,
} from "./delays-view-model";
import { DelaysWaitTimeline } from "./delays-data-views";
import styles from "./delays-coordination.module.css";

const severeWaitHours = ED_SEVERE_PRESSURE_WAIT_MINUTES / 60;
const twelveWaitHours = overTwelveHoursMinutes / 60;
const fourWaitHours = severeWaitHours / 2;

export type DelayQueueScope = { owner: DelayOwnerId } | { origin: CatchmentOrigin };
type Props = {
  markedOwner?: DelayOwnerId | null;
  onMarkOwner?: (owner: DelayOwnerId) => void;
  rows: DelayRecord[];
  now: Instant;
  onViewQueue: (scope: DelayQueueScope) => void;
};
type Graph = "catchment" | "radar" | "timeline" | "runway";
const GRAPHS: { id: Graph; label: string; title: string; subtitle: string }[] = [
  {
    id: "catchment",
    label: "Catchment pressure",
    title: "Catchment pressure",
    subtitle: `Recorded waits, who was already waiting, and who crosses ${severeWaitHours}h and ${twelveWaitHours}h if nothing changes`,
  },
  { id: "radar", label: "Crisis radar", title: "Crisis radar", subtitle: "Each person by recorded ED wait" },
  { id: "timeline", label: "Wait Timeline", title: "Wait timeline", subtitle: "Elapsed wait and last recorded change" },
  {
    id: "runway",
    label: "Action runway",
    title: "Action runway",
    subtitle: "Recorded times that need a next step",
  },
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
function Key({
  amber = false,
  tone,
  children,
}: {
  amber?: boolean;
  tone?: "waiting" | "amber" | "danger" | "muted" | "expected";
  children: React.ReactNode;
}) {
  return (
    <span className={styles.key}>
      <i data-amber={amber || undefined} data-tone={tone ?? (amber ? "amber" : "waiting")} />
      {children}
    </span>
  );
}
function initialsOf(name: string) {
  return name
    .split(/\s+/u)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
function spreadPercent(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return 22 + (hash % 56);
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
function attentionRows(rows: DelayRecord[], now: Instant) {
  const past = rows.filter(({ movement }) => (legalDeadlineMinutes(movement, now) ?? Infinity) < 0);
  const imminent = rows.filter(({ movement }) => {
    const due = legalDeadlineMinutes(movement, now);
    return due !== undefined && due >= 0 && due <= DUE_SOON_URGENT_MINUTES;
  });
  const attention = [...past, ...imminent].sort(
    (a, b) => (legalDeadlineMinutes(a.movement, now) ?? Infinity) - (legalDeadlineMinutes(b.movement, now) ?? Infinity),
  );
  return { past, imminent, attention };
}
function waitBands(rows: DelayRecord[], now: Instant) {
  const wait = (movement: DelayRecord["movement"]) => now - movement.openedAt;
  return [
    {
      label: `Under ${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60}h`,
      count: rows.filter(({ movement }) => wait(movement) < ED_SEVERE_PRESSURE_WAIT_MINUTES).length,
    },
    {
      label: `${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60}–${overTwelveHoursMinutes / 60}h`,
      count: rows.filter(
        ({ movement }) => wait(movement) >= ED_SEVERE_PRESSURE_WAIT_MINUTES && wait(movement) < overTwelveHoursMinutes,
      ).length,
    },
    {
      label: `Over ${overTwelveHoursMinutes / 60}h`,
      count: rows.filter(
        ({ movement }) => wait(movement) >= overTwelveHoursMinutes && wait(movement) < LONG_WAIT_MINUTES,
      ).length,
    },
    {
      label: `Over ${LONG_WAIT_MINUTES / 60}h`,
      count: rows.filter(({ movement }) => wait(movement) >= LONG_WAIT_MINUTES).length,
    },
  ];
}
function UrgentQueue({ rows, now }: Pick<Props, "rows" | "now">) {
  const patientOf = usePatientOf();
  const { attention } = attentionRows(rows, now);
  if (attention.length === 0) {
    return <p className={styles.noAttention}>No recorded due times requiring attention within 60m.</p>;
  }
  return (
    <div className={styles.urgentList}>
      {attention.map((record) => {
        const due = legalDeadlineMinutes(record.movement, now)!;
        return (
          <div className={styles.urgentRow} data-past={due < 0} key={record.movement.id}>
            <Clock size={18} aria-hidden="true" />
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
    </div>
  );
}
function ActionRunway({ rows, now, onViewQueue, markedOwner, onMarkOwner }: Props) {
  const patientOf = usePatientOf();
  const [openId, setOpenId] = useState<string | null>(null);
  const { past, imminent, attention } = attentionRows(rows, now);
  const icons = { yours: Users, wards: BedDouble, ed: Hospital, transport: Truck, other: UserRound };
  const bands = waitBands(rows, now);
  return (
    <section
      className={styles.runway}
      aria-label="Action runway"
      data-ward-primitive="panel"
      onKeyDown={(event) => {
        if (event.key === "Escape" && openId !== null) {
          event.preventDefault();
          setOpenId(null);
        }
      }}
    >
      <header className={styles.runwayHeader}>
        <h2>
          <Clock size={16} aria-hidden="true" />
          Pressure
        </h2>
        <span className={styles.attentionSummary} data-past={past.length > 0}>
          {past.length} past recorded time · {imminent.length} due within 60m
        </span>
      </header>
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
                    {severe}
                  </span>
                )}
                {records.length > 0 && (
                  <button
                    type="button"
                    className={styles.queueLink}
                    onClick={() => onViewQueue({ owner: owner.id })}
                    aria-label={`View ${teamName(owner.id)} queue`}
                  >
                    Queue
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.waitDistribution}>
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
              {band.label}: <b>{band.count}</b>
            </span>
          ))}
        </div>
        <div className={styles.urgentChips} role="list" aria-label="Urgent recorded times">
          {attention.map((record) => {
            const due = legalDeadlineMinutes(record.movement, now)!;
            const name = patientOf(record.movement).displayName;
            const open = openId === record.movement.id;
            const time = due < 0 ? `+${splitDuration(-due)}` : dueDuration(due);
            return (
              <div className={styles.urgentChip} role="listitem" key={record.movement.id}>
                <button
                  type="button"
                  data-past={due < 0}
                  aria-expanded={open}
                  aria-label={`${initialsOf(name)}, ${time}. Show recorded time`}
                  onClick={() => setOpenId(open ? null : record.movement.id)}
                >
                  <b>{initialsOf(name)}</b>
                  <span>{time}</span>
                </button>
                {open && (
                  <div className={styles.chipPopup} role="dialog" aria-label={`${name} recorded time`}>
                    <strong>{name}</strong>
                    <span>
                      {originName(record)} ·{" "}
                      {record.movement.legalForm ? legalFormName(record.movement.legalForm) : "No form recorded"}
                    </span>
                    <span>
                      {due < 0 ? `Past recorded time by ${splitDuration(-due)}` : `Due in ${dueDuration(due)}`}
                      {" · "}ED wait {splitDuration(Math.max(0, now - record.movement.openedAt))}
                    </span>
                    <MovementAction record={record}>Review</MovementAction>
                  </div>
                )}
              </div>
            );
          })}
          {attention.length === 0 && <p className={styles.noAttention}>No recorded due times within 60m.</p>}
        </div>
      </div>
    </section>
  );
}

const SERVICE_MARKS: CatchmentOrigin[] = ["North Metro", "East Metro", "South Metro", "WACHS"];
function CatchmentPressure({ rows, now, onViewQueue }: Props) {
  const [owner, setOwner] = useState<DelayOwnerId | "all">("all");
  const [service, setService] = useState<CatchmentOrigin | "all">("all");
  const [selected, setSelected] = useState<CatchmentOrigin | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const returnFocus = useRef<SVGGElement | null>(null);
  const close = () => {
    setSelected(null);
    returnFocus.current?.focus();
  };
  const owned = rows.filter(({ cause }) => owner === "all" || ownerOf(cause) === owner);
  const serviceStats = delayCatchments(owned, now);
  const filtered =
    service === "all"
      ? owned
      : owned.filter(({ movement }) => (edHealthService(movement.originEdId) ?? "unrecorded") === service);
  const stats = delayCatchments(filtered, now);
  const max = Math.max(4, ...stats.map((entry) => Math.max(entry.total, entry.expectedOver8, entry.stillWaiting4hAgo)));
  const step = max <= 40 ? Math.max(1, Math.ceil(max / 4 / 5) * 5) : Math.ceil(max / 4 / 10) * 10;
  const ceiling = step * 4;
  const choice = stats.find((entry) => entry.origin === selected);
  const hovered = hover === null ? undefined : stats[hover];
  function renderGraph() {
    const width = 1100;
    const height = 310;
    const left = 84;
    const right = 36;
    const top = 28;
    const bottom = height - 52;
    const x = (index: number) => left + (index / Math.max(1, stats.length - 1)) * (width - left - right);
    const y = (value: number) => bottom - (value / ceiling) * (bottom - top);
    const line = (pick: (entry: (typeof stats)[number]) => number) =>
      stats.map((entry, index) => `${index ? "L" : "M"}${x(index)},${y(pick(entry))}`).join(" ");
    const totalPath = line((entry) => entry.total);
    return (
      <svg
        className={styles.desktopPressure}
        viewBox={`0 0 ${width} ${height}`}
        aria-label={`People waiting by origin catchment. ${stats.map((entry) => `${CATCHMENTS[entry.origin].short}: ${entry.total} waiting, ${entry.over8} over ${severeWaitHours} hours, ${entry.over12} over ${twelveWaitHours} hours`).join("; ")}`}
        role="group"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const viewX = ((event.clientX - rect.left) / rect.width) * width;
          let nearest = 0;
          let best = Infinity;
          stats.forEach((_, index) => {
            const distance = Math.abs(x(index) - viewX);
            if (distance < best) {
              best = distance;
              nearest = index;
            }
          });
          setHover(nearest);
        }}
        onMouseLeave={() => setHover(null)}
      >
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
        <text
          transform={`translate(16 ${top + (bottom - top) / 2}) rotate(-90)`}
          textAnchor="middle"
          className={styles.axisText}
        >
          People waiting
        </text>
        {stats.map((entry, index) => (
          <line key={entry.origin} x1={x(index)} x2={x(index)} y1={top} y2={bottom} className={styles.gridLine} />
        ))}
        {hovered && <line x1={x(hover!)} x2={x(hover!)} y1={top} y2={bottom} className={styles.hoverGuide} />}
        <path d={`${totalPath} L${x(stats.length - 1)},${bottom} L${x(0)},${bottom} Z`} className={styles.totalFill} />
        <line x1={left - 8} x2={width - right + 15} y1={bottom} y2={bottom} className={styles.baseline} />
        <path d={line((entry) => entry.stillWaiting4hAgo)} className={styles.earlierLine} />
        <path d={line((entry) => entry.expectedOver8)} className={styles.expectedLine} />
        <path d={totalPath} className={styles.totalLine} />
        <path d={line((entry) => entry.over8)} className={styles.longLine} />
        <path d={line((entry) => entry.over12)} className={styles.over12Line} />
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
            <rect x={x(index) - 48} y={top - 8} width={96} height={height - top} fill="transparent" />
            <circle cx={x(index)} cy={y(entry.total)} r={4.5} className={styles.totalPoint} />
            <circle cx={x(index)} cy={y(entry.over8)} r={4} className={styles.longPoint} />
            <circle cx={x(index)} cy={y(entry.over12)} r={4} className={styles.over12Point} />
            <text x={x(index)} y={y(entry.total) - 10} textAnchor="middle" className={styles.totalLabel}>
              {entry.total}
            </text>
            <text x={x(index)} y={bottom + 22} textAnchor="middle" className={styles.axisText}>
              {CATCHMENTS[entry.origin].code || CATCHMENTS[entry.origin].short}
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
            setHover(null);
          }}
          label="Catchment pressure owner"
        />
        <div className={styles.serviceMarks} role="group" aria-label="Health service">
          <button type="button" aria-pressed={service === "all"} onClick={() => setService("all")}>
            All
          </button>
          {SERVICE_MARKS.map((origin) => {
            const mark = serviceStats.find((entry) => entry.origin === origin);
            const total = mark?.total ?? 0;
            const peak = Math.max(1, ...serviceStats.map((entry) => entry.total));
            return (
              <button
                key={origin}
                type="button"
                aria-pressed={service === origin}
                onClick={() => {
                  setService(origin);
                  setSelected(origin);
                }}
              >
                <span>{CATCHMENTS[origin].code}</span>
                <i aria-hidden="true">
                  <b style={{ width: `${(total / peak) * 100}%` }} />
                  <b data-amber style={{ width: `${((mark?.over8 ?? 0) / peak) * 100}%` }} />
                </i>
                <strong>{total}</strong>
              </button>
            );
          })}
        </div>
        <span className={styles.snapshot}>
          <Clock size={14} aria-hidden="true" />
          {formatInstantWithDay(now, now)}
        </span>
      </div>
      <div className={styles.pressurePlot}>
        {renderGraph()}
        {hovered && (
          <div className={styles.hoverCard} style={{ left: `${((hover! + 0.5) / Math.max(1, stats.length)) * 100}%` }}>
            <strong>
              {CATCHMENTS[hovered.origin].short}
              {CATCHMENTS[hovered.origin].code ? ` · ${CATCHMENTS[hovered.origin].code}` : ""}
            </strong>
            <span>Waiting {hovered.total}</span>
            <span>
              Over {severeWaitHours}h {hovered.over8}
            </span>
            <span>
              Over {twelveWaitHours}h {hovered.over12}
            </span>
            <span>
              Still waiting from {fourWaitHours}h ago {hovered.stillWaiting4hAgo}
            </span>
            <span>
              Still waiting from {severeWaitHours}h ago {hovered.stillWaiting8hAgo}
            </span>
            <span>
              If nothing changes, over {severeWaitHours}h in {fourWaitHours}h {hovered.expectedOver8}
            </span>
            <span>
              If nothing changes, over {twelveWaitHours}h in {fourWaitHours}h {hovered.expectedOver12}
            </span>
          </div>
        )}
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
          <div data-danger>
            <b>{choice.over12}</b>
            <small>over {overTwelveHoursMinutes / 60}h</small>
          </div>
          <div>
            <b>{choice.expectedOver8}</b>
            <small>over {severeWaitHours}h if nothing changes</small>
          </div>
          <button type="button" className={styles.primary} onClick={() => onViewQueue({ origin: choice.origin })}>
            View {choice.total} people
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <Close onClick={close} label="Close catchment details" />
        </div>
      )}
      <footer className={styles.chartFooter}>
        <div className={styles.keys}>
          <Key>Waiting</Key>
          <Key amber>Over {severeWaitHours}h</Key>
          <Key tone="danger">Over {twelveWaitHours}h</Key>
          <Key tone="muted">Still waiting from {fourWaitHours}h ago</Key>
          <Key tone="expected">Over {severeWaitHours}h if nothing changes</Key>
        </div>
        <span>
          <Info size={14} aria-hidden="true" />
          Counted once by origin ED · Synthetic records
        </span>
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
function plotGroups(people: DelayRecord[], now: Instant) {
  const sorted = [...people].sort((a, b) => b.movement.openedAt - a.movement.openedAt);
  const groups: DelayRecord[][] = [];
  for (const record of sorted) {
    const wait = Math.max(0, now - record.movement.openedAt);
    const current = groups.at(-1);
    const last = current?.[current.length - 1];
    const lastWait = last === undefined ? Infinity : Math.max(0, now - last.movement.openedAt);
    if (current && Math.abs(lastWait - wait) <= 20) current.push(record);
    else groups.push([record]);
  }
  return groups;
}
function CrisisRadar({ rows, now }: Pick<Props, "rows" | "now">) {
  const patientOf = usePatientOf();
  const [owner, setOwner] = useState<DelayOwnerId | "all">("all");
  const [windowMinutes, setWindowMinutes] = useState(LONG_WAIT_MINUTES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cluster, setCluster] = useState<{ label: string; ids: string[] } | null>(null);
  const focusReturn = useRef<HTMLElement | null>(null);
  const filtered = rows.filter(({ cause }) => owner === "all" || ownerOf(cause) === owner);
  const graph = delayRadarGroups(filtered, now, windowMinutes);
  const selected = filtered.find(({ movement }) => movement.id === selectedId);
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
            setSelectedId(null);
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
            setSelectedId(null);
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
                {plotGroups(lane.inView, now).map((group) => {
                  const wait = (record: DelayRecord) => Math.max(0, now - record.movement.openedAt);
                  const mean = group.reduce((sum, record) => sum + wait(record), 0) / group.length;
                  const left = `${(mean / windowMinutes) * 100}%`;
                  if (group.length >= 3) {
                    return (
                      <button
                        type="button"
                        key={group[0].movement.id}
                        className={styles.countDot}
                        data-band={lane.band}
                        style={{ left, top: "50%" }}
                        aria-label={`${group.length} people, ${LANES[lane.band]}, around ${Math.round(mean / 60)} hours. Show the list`}
                        onClick={(event) => {
                          focusReturn.current = event.currentTarget;
                          setSelectedId(null);
                          setCluster({
                            label: `${LANES[lane.band]} · ${Math.floor(mean / 60)}h`,
                            ids: group.map(({ movement }) => movement.id),
                          });
                        }}
                      >
                        {group.length}
                      </button>
                    );
                  }
                  return group.map((record) => (
                    <button
                      type="button"
                      key={record.movement.id}
                      className={styles.personDot}
                      data-band={lane.band}
                      style={{
                        left: `${(wait(record) / windowMinutes) * 100}%`,
                        top: `${spreadPercent(record.movement.id)}%`,
                      }}
                      aria-label={`Inspect person waiting ${splitDuration(wait(record))} in ${LANES[lane.band]}`}
                      onClick={(event) => pick(record, event.currentTarget)}
                    >
                      <span className={styles.dotName}>{patientOf(record.movement).displayName}</span>
                    </button>
                  ));
                })}
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
                    <strong className={styles.revealName}>{patientOf(record.movement).displayName}</strong>
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
            <button
              key={record.movement.id}
              type="button"
              className={styles.outlierChip}
              data-band={delayRadarBand(record.movement, now)}
              onClick={(event) => pick(record, event.currentTarget)}
            >
              <UserRound size={14} aria-hidden="true" />
              <b>{splitDuration(Math.max(0, now - record.movement.openedAt))}</b>
              <strong className={styles.revealName}>{patientOf(record.movement).displayName}</strong>
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
        <span>Dot: one person · Larger dot: people close together · Hover for the name</span>
        <div className={styles.keys}>
          <Key>Waiting</Key>
          <Key amber>Due within 60m</Key>
          <Key tone="danger">Past recorded time</Key>
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
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? GRAPHS.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : GRAPHS.length - 1)) % GRAPHS.length;
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
          <div hidden={graph !== "runway"}>{visited.includes("runway") && <UrgentQueue {...props} />}</div>
        </div>
      </section>
    </div>
  );
}
