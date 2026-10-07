"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Clock, RotateCcw, UserRound, Users, X } from "lucide-react";
import { splitDuration, type Instant } from "../ward-clock";
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
  delayRadarBand,
  delayRadarGroups,
  overTwelveHoursMinutes,
  type CatchmentOrigin,
  type DelayRecord,
  type RadarBand,
} from "./delays-view-model";
import { DelaysWaitTimeline } from "./delays-data-views";
import { Button, Card, CardHead, Icon, Legend, StatusGlyph, Timer, fillClass, type WfFill } from "@/components/wf";
import styles from "./delays-coordination.module.css";

const severeWaitHours = ED_SEVERE_PRESSURE_WAIT_MINUTES / 60;
const twelveWaitHours = overTwelveHoursMinutes / 60;
const fourWaitHours = severeWaitHours / 2;
const MINUTE = 60_000;

export type DelayQueueScope = { owner: DelayOwnerId } | { origin: CatchmentOrigin };
type Props = {
  markedOwner?: DelayOwnerId | null;
  onMarkOwner?: (owner: DelayOwnerId) => void;
  rows: DelayRecord[];
  now: Instant;
  onViewQueue: (scope: DelayQueueScope) => void;
};
type Graph = "catchment" | "radar" | "timeline" | "runway";
const GRAPHS: { id: Graph; label: string; title: string }[] = [
  { id: "catchment", label: "By catchment", title: "Waiting by catchment" },
  { id: "radar", label: "Legal and ED", title: "Legal and ED waits" },
  { id: "timeline", label: "Waits", title: "Waits and last change" },
  { id: "runway", label: "Runway", title: "Recorded times needing a next step" },
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
function recordedTimeRows(rows: DelayRecord[], now: Instant) {
  return rows
    .filter(({ movement }) => (legalDeadlineMinutes(movement, now) ?? Infinity) <= DUE_SOON_MINUTES)
    .sort(
      (a, b) =>
        (legalDeadlineMinutes(a.movement, now) ?? Infinity) - (legalDeadlineMinutes(b.movement, now) ?? Infinity),
    );
}
const BAND_FILLS: WfFill[] = ["data-3", "data-2", "warning", "danger"];
function ActionRunway({ rows, now, onViewQueue, markedOwner, onMarkOwner }: Props) {
  const patientOf = usePatientOf();
  const { past, imminent } = attentionRows(rows, now);
  const recorded = recordedTimeRows(rows, now);
  const bands = waitBands(rows, now);
  return (
    <Card className={styles.runway} aria-label="Action runway" data-ward-primitive="panel">
      <CardHead
        icon={Clock}
        title="Pressure"
        aside={
          <span className={styles.attentionSummary} data-past={past.length > 0}>
            <StatusGlyph tone={past.length > 0 ? "danger" : imminent.length > 0 ? "warning" : "neutral"} size={9} />
            {past.length > 0 ? `${past.length} past recorded time · ` : ""}
            {imminent.length} due within {DUE_SOON_URGENT_MINUTES}m
          </span>
        }
      />
      <div className={styles.ownerGrid}>
        {DELAY_OWNERS.map((owner) => {
          const records = rows.filter(({ cause }) => ownerOf(cause) === owner.id);
          const severe = records.filter(({ cause }) => SEVERE_CAUSES.includes(cause)).length;
          return (
            <div className={styles.ownerCard} key={owner.id}>
              <button
                type="button"
                className={styles.ownerMark}
                data-testid={`delays-owner-${owner.id}`}
                aria-label={`Mark ${teamName(owner.id)} waiting records`}
                aria-pressed={markedOwner === owner.id}
                onClick={() => onMarkOwner?.(owner.id)}
              >
                <span className={styles.ownerName}>{teamName(owner.id)}</span>
                <span className={styles.ownerCount}>
                  <b>{records.length}</b>
                  {severe > 0 && (
                    <span className={styles.critical}>
                      <StatusGlyph tone="danger" size={9} />
                      {severe} severe
                    </span>
                  )}
                </span>
              </button>
              {records.length > 0 ? (
                <button
                  type="button"
                  className={styles.queueLink}
                  onClick={() => onViewQueue({ owner: owner.id })}
                  aria-label={`View ${teamName(owner.id)} queue`}
                >
                  Show queue
                </button>
              ) : (
                <span className={styles.queueNone}>Nothing waiting</span>
              )}
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
          {bands.map((band, index) =>
            band.count > 0 ? (
              <span
                key={band.label}
                className={fillClass(BAND_FILLS[index])}
                style={{ flexGrow: band.count, flexBasis: 0 }}
              />
            ) : null,
          )}
        </div>
        <Legend
          className={styles.distributionLegend}
          items={bands.map((band, index) => ({
            id: band.label,
            label: band.label.replace("–", " to "),
            fill: BAND_FILLS[index],
            value: band.count,
          }))}
        />
      </div>
      <div className={styles.recordedTimes}>
        <h3 className={styles.recordedTitle}>Recorded times</h3>
        {recorded.length === 0 ? (
          <p className={styles.noAttention}>No recorded due times within {DUE_SOON_MINUTES / 60}h.</p>
        ) : (
          <ul className={styles.recordedList} aria-label="Urgent recorded times">
            {recorded.map((record) => {
              const due = legalDeadlineMinutes(record.movement, now)!;
              return (
                <li key={record.movement.id}>
                  <Link
                    className={styles.recordedRow}
                    href={`/mockups/ward-flow/movements/${record.movement.id}`}
                    data-past={due < 0}
                  >
                    <strong>{patientOf(record.movement).formalName}</strong>
                    <span className={styles.recordedMeta}>
                      {record.movement.legalForm ? legalFormName(record.movement.legalForm) : "No form recorded"},{" "}
                      {originName(record)}
                    </span>
                    <Timer
                      at={(now + due) * MINUTE}
                      now={now * MINUTE}
                      direction="left"
                      thresholds={{ dueSoon: DUE_SOON_URGENT_MINUTES * MINUTE }}
                      chip
                      hideFlagWord
                    />
                    <Icon icon={ChevronRight} size={14} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

function CatchmentPressure({ rows, now, onViewQueue, owner }: Props & { owner: DelayOwnerId | "all" }) {
  const [selected, setSelected] = useState<CatchmentOrigin | null>(null);
  const [hover, setHover] = useState<CatchmentOrigin | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const close = () => {
    setSelected(null);
    returnFocus.current?.focus();
  };
  const owned = rows.filter(({ cause }) => owner === "all" || ownerOf(cause) === owner);
  const stats = delayCatchments(owned, now);
  const max = Math.max(4, ...stats.map((entry) => entry.total));
  const step = max <= 40 ? Math.max(1, Math.ceil(max / 4 / 5) * 5) : Math.ceil(max / 4 / 10) * 10;
  const ceiling = step * 4;
  const mean = stats.length ? stats.reduce((sum, entry) => sum + entry.total, 0) / stats.length : 0;
  const pct = (value: number) => `${(value / ceiling) * 100}%`;
  const choice = stats.find((entry) => entry.origin === selected);
  const hovered = stats.find((entry) => entry.origin === hover);
  return (
    <div
      className={styles.catchment}
      onKeyDown={(event) => {
        if (event.key === "Escape" && selected !== null) {
          event.preventDefault();
          close();
        }
      }}
    >
      <div
        className={styles.barChart}
        role="group"
        aria-label={`People waiting by origin catchment. ${stats.map((entry) => `${CATCHMENTS[entry.origin].short}: ${entry.total} waiting, ${entry.over8} over ${severeWaitHours} hours, ${entry.over12} over ${twelveWaitHours} hours`).join("; ")}`}
        onMouseLeave={() => setHover(null)}
      >
        <div className={styles.barLayer} aria-hidden="true">
          {[1, 2, 3, 4].map((tick) => (
            <span key={tick} className={styles.barTick} style={{ left: pct(tick * step) }}>
              {tick * step}
            </span>
          ))}
          {stats.length > 0 && (
            <span className={styles.barMean} style={{ left: pct(mean) }}>
              mean {Number.isInteger(mean) ? mean : mean.toFixed(1)}
            </span>
          )}
        </div>
        {stats.map((entry) => {
          const crossing = entry.expectedOver8 - entry.over8;
          const segments = [
            { id: "under", value: entry.total - entry.expectedOver8, className: fillClass("data-3") },
            { id: "crossing", value: crossing, className: fillClass("data-2", true) },
            { id: "eight", value: entry.over8 - entry.over12, className: fillClass("warning") },
            { id: "twelve", value: entry.over12, className: fillClass("danger") },
          ].filter((segment) => segment.value > 0);
          return (
            <button
              type="button"
              key={entry.origin}
              className={styles.barRow}
              aria-label={`Inspect ${CATCHMENTS[entry.origin].full}: ${entry.total} waiting`}
              aria-pressed={selected === entry.origin}
              onMouseEnter={() => setHover(entry.origin)}
              onFocus={() => setHover(entry.origin)}
              onBlur={() => setHover(null)}
              onClick={(event) => {
                returnFocus.current = event.currentTarget;
                setSelected(selected === entry.origin ? null : entry.origin);
              }}
            >
              <span className={styles.barName}>
                <strong>{CATCHMENTS[entry.origin].short}</strong>
                {CATCHMENTS[entry.origin].code ? <small>{CATCHMENTS[entry.origin].code}</small> : null}
              </span>
              <span className={styles.barTrack}>
                <span className={styles.barFill} style={{ width: pct(entry.total) }}>
                  {segments.map((segment) => (
                    <span key={segment.id} className={segment.className} style={{ flexGrow: segment.value }} />
                  ))}
                </span>
                <b className={styles.barCount}>{entry.total}</b>
              </span>
            </button>
          );
        })}
        {hovered && hovered.total > 0 && (
          <div className={styles.hoverCard} aria-hidden="true">
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
              If nothing changes, over {severeWaitHours}h in {fourWaitHours}h {hovered.expectedOver8}
            </span>
            <span>
              If nothing changes, over {twelveWaitHours}h in {fourWaitHours}h {hovered.expectedOver12}
            </span>
          </div>
        )}
      </div>
      {choice && (
        <div className={styles.catchmentInspector}>
          <div>
            <strong>
              {CATCHMENTS[choice.origin].full}
              {CATCHMENTS[choice.origin].code ? <span> ({CATCHMENTS[choice.origin].code})</span> : null}
            </strong>
            <small>Selected catchment</small>
          </div>
          <div>
            <b>{choice.total}</b>
            <small>waiting</small>
          </div>
          <div>
            <b>{choice.over8}</b>
            <small>over {severeWaitHours}h</small>
          </div>
          <div>
            <b>{choice.over12}</b>
            <small>over {twelveWaitHours}h</small>
          </div>
          <div>
            <b>{choice.expectedOver8}</b>
            <small>over {severeWaitHours}h if nothing changes</small>
          </div>
          <Button
            variant="pri"
            size="sm"
            icon={ArrowRight}
            disabled={choice.total === 0}
            onClick={() => onViewQueue({ origin: choice.origin })}
          >
            View {choice.total} people
          </Button>
          <Button variant="ghost" size="sm" icon={X} iconOnly aria-label="Close catchment details" onClick={close} />
        </div>
      )}
      <Legend
        className={styles.barLegend}
        items={[
          { id: "under", label: `Under ${severeWaitHours}h`, fill: "data-3" },
          { id: "crossing", label: `Crosses ${severeWaitHours}h in ${fourWaitHours}h`, fill: "data-2", hatch: true },
          { id: "eight", label: `${severeWaitHours} to ${twelveWaitHours}h`, fill: "warning" },
          { id: "twelve", label: `Over ${twelveWaitHours}h`, fill: "danger" },
        ]}
      />
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
  const [owner, setOwner] = useState<DelayOwnerId | "all">("all");
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
      <Card className={styles.graphPanel} aria-label="Delay graphs" data-ward-primitive="panel">
        <CardHead
          title={current.title}
          className={styles.graphHead}
          action={
            graph === "catchment" ? (
              <OwnerSelect value={owner} onChange={setOwner} label="By catchment owner" />
            ) : undefined
          }
        />
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
        <div className={styles.graphBody} role="tabpanel" id={`${id}-graph-panel`} aria-labelledby={`${id}-${graph}`}>
          <div hidden={graph !== "catchment"}>
            {visited.includes("catchment") && <CatchmentPressure {...props} owner={owner} />}
          </div>
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
      </Card>
    </div>
  );
}
