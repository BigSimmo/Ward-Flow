"use client";

import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { useMemo, useState, type CSSProperties } from "react";
import { BedDouble, Clock, Columns3, Route } from "lucide-react";

import { Button, CardBody, Legend, SrOnly, StatusGlyph, cx, type WfTone } from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { dayOf, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { BedRelease, LeaveBed, Movement, MovementStage, Unit } from "@/components/ward-management/ward-model";
import { LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { allEmergencyDepartments, edShortName, siteByCode } from "@/components/ward-management/ward-sites";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { edStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";

import { StatisticsEdSwarm, type EdSwarmRow } from "./statistics-ed-swarm";
import { edWaitFigures } from "./statistics-ed-waits";
import { StatCard } from "./statistics-hero";
import { FlushRow, Follow } from "./statistics-layout";
import styles from "./statistics-journey-view.module.css";

export type JourneyStageId = "waiting" | "referred" | "accepted" | "moving" | "ward" | "planned" | "discharged";

export type JourneyStage = {
  id: JourneyStageId;
  label: string;
  /** What the figure counts, in a few words. */
  caption: string;
  tone: WfTone;
  count: number;
  breakdown: ReadonlyArray<{ label: string; value: string | number; tone?: WfTone }>;
};

const IN_TRANSIT = ["pulled", "handover_ready", "moving"] as const satisfies readonly MovementStage[];

/** One word each, so the breakdown fits a seventh of the row; the full stage words are `stageCopy`'s. */
const TRANSIT_LABELS: Record<(typeof IN_TRANSIT)[number], string> = {
  pulled: stageCopy.pulled.shortLabel,
  handover_ready: "Handover",
  moving: stageCopy.moving.shortLabel,
};

/** "Royal Perth Hospital" reads "Royal Perth", as the Summary's ED table shortens it. */
const shortSiteName = (name: string) =>
  name
    .replace(/ Emergency Department$/, "")
    .replace(/ (Memorial |General )?(Hospital|Health Campus|Health Service)$/, "");

const waitedPastADay = (movement: Movement, now: Instant) => now - movement.openedAt >= LONG_WAIT_MINUTES;

/**
 * The patient journey right now, ED to discharge, as seven stages. Each figure is read from the
 * synthetic state with the rules the other statistics screens already use: open movements by stage
 * for the ED side, `bedStates` occupancy for the ward, and the ward page's "Due out, 7 days" and the
 * Summary's "Discharged today" for the way out. The four ED stages partition the open movements, so
 * they add up to the Summary's "Waiting in ED".
 */
export function journeyStages({
  units,
  admissions,
  bedReleases,
  leaveBeds,
  movements,
  now,
}: {
  units: readonly Unit[];
  admissions: readonly Admission[];
  bedReleases: BedRelease[];
  leaveBeds: readonly LeaveBed[];
  movements: readonly Movement[];
  now: Instant;
}): JourneyStage[] {
  const open = movements.filter(isOpen);
  const inStage = (stages: readonly MovementStage[]) => open.filter((movement) => stages.includes(movement.stage));
  const waiting = inStage(["placement_requested"]);
  const referred = inStage(["destination_review"]);
  const accepted = inStage(["accepted_awaiting_bed"]);
  const moving = inStage(IN_TRANSIT);

  const beds = units.reduce(
    (sum, unit) => {
      const states = bedStates(unit, admissions, bedReleases, leaveBeds);
      return {
        beds: sum.beds + unit.beds,
        occupied: sum.occupied + states.occupied,
        ready: sum.ready + states.ready,
        onLeave: sum.onLeave + states.onLeave,
      };
    },
    { beds: 0, occupied: 0, ready: 0, onLeave: 0 },
  );

  const today = dayOf(now);
  // The ward page's "Due out, 7 days": on the ward (not pulled), with a date from now to six days on.
  const planned = admissions.filter(
    (admission) =>
      admission.state !== "departed" &&
      admission.state !== "pulled" &&
      admission.expectedDischargeAt !== null &&
      admission.expectedDischargeAt >= now &&
      dayOf(admission.expectedDischargeAt) - today < 7,
  );
  const plannedOn = (offset: number) =>
    planned.filter((admission) => dayOf(admission.expectedDischargeAt as number) === today + offset).length;
  const left = admissions.filter((admission) => admission.leftAt !== null && dayOf(admission.leftAt) === today);
  const toCommunity = left.filter((admission) => admission.leavingDestination === "discharged-to-the-community");
  const transferred = left.filter((admission) => admission.leavingDestination?.startsWith("transferred-"));

  const pastADay = (list: readonly Movement[]) => list.filter((movement) => waitedPastADay(movement, now)).length;
  const urgent = (list: readonly Movement[]) => list.filter((movement) => movement.flaggedUrgent).length;
  const warnIf = (value: number): WfTone | undefined => (value > 0 ? "warning" : undefined);

  return [
    {
      id: "waiting",
      label: "Waiting in ED",
      caption: "No ward has answered",
      tone: "neutral",
      count: waiting.length,
      breakdown: [
        { label: "Past 24h", value: pastADay(waiting), tone: warnIf(pastADay(waiting)) },
        { label: "Urgent", value: urgent(waiting) },
        { label: "EDs", value: new Set(waiting.map((movement) => movement.originEdId)).size },
      ],
    },
    {
      id: "referred",
      label: "Referred",
      caption: "A ward is weighing it up",
      tone: "neutral",
      count: referred.length,
      breakdown: [
        { label: "Past 24h", value: pastADay(referred), tone: warnIf(pastADay(referred)) },
        { label: "Urgent", value: urgent(referred) },
        { label: "Declined", value: referred.filter((movement) => movement.declines.length > 0).length },
      ],
    },
    {
      id: "accepted",
      label: "Accepted",
      caption: "No bed pulled yet",
      tone: "success",
      count: accepted.length,
      breakdown: [
        { label: "Past 24h", value: pastADay(accepted), tone: warnIf(pastADay(accepted)) },
        { label: "Urgent", value: urgent(accepted) },
        { label: "Wards", value: new Set(accepted.map((movement) => movement.acceptedUnitId)).size },
      ],
    },
    {
      id: "moving",
      label: "Pulled or in transit",
      caption: "Bed given, not arrived",
      tone: "info",
      count: moving.length,
      breakdown: IN_TRANSIT.map((stage) => ({
        label: TRANSIT_LABELS[stage],
        value: moving.filter((movement) => movement.stage === stage).length,
      })),
    },
    {
      id: "ward",
      label: "On the ward",
      caption: "In a bed, leave included",
      tone: "success",
      count: beds.occupied,
      breakdown: [
        { label: "Of beds", value: `${beds.beds > 0 ? Math.round((beds.occupied / beds.beds) * 100) : 0}%` },
        { label: "On leave", value: beds.onLeave },
        { label: "Ready beds", value: beds.ready },
      ],
    },
    {
      id: "planned",
      label: "Discharge planned",
      caption: "Date in the next 7 days",
      tone: "info",
      count: planned.length,
      breakdown: [
        { label: "Today", value: plannedOn(0) },
        { label: "Tomorrow", value: plannedOn(1) },
        {
          label: "Blocked",
          value: planned.filter((admission) => admission.blockReason !== null).length,
          tone: warnIf(planned.filter((admission) => admission.blockReason !== null).length),
        },
      ],
    },
    {
      id: "discharged",
      label: "Discharged today",
      caption: "Left the ward today",
      tone: "success",
      count: left.length,
      breakdown: [
        { label: "Community", value: toCommunity.length },
        { label: "Transferred", value: transferred.length },
        { label: "Other", value: left.length - toCommunity.length - transferred.length },
      ],
    },
  ];
}

/* Ribbon geometry, in viewBox units across and pixels down. */
const VIEW_W = 1000;
const NODE_W = 100;
const RIBBON_H = 210;
const MID = 100;
const NODE_MAX = 112;
const NODE_MIN = 28;

/**
 * Seven stages left to right. Box height grows with the square root of the count, so a ward of 240
 * and a queue of 9 both stay readable, and the bands between them narrow or widen with the flow.
 */
function JourneyRibbon({
  stages,
  selected,
  onSelect,
}: {
  stages: readonly JourneyStage[];
  selected: JourneyStageId | null;
  onSelect: (id: JourneyStageId) => void;
}) {
  const max = Math.max(1, ...stages.map((stage) => stage.count));
  const gap = (VIEW_W - stages.length * NODE_W) / Math.max(1, stages.length - 1);
  const height = (count: number) => Math.max(NODE_MIN, Math.sqrt(count / max) * NODE_MAX);
  const x = (index: number) => index * (NODE_W + gap);
  const pct = (units: number) => `${(units / VIEW_W) * 100}%`;

  return (
    <div className={styles.ribbonScroll}>
      <div className={styles.ribbon} style={{ height: RIBBON_H }}>
        <svg
          className={styles.bands}
          viewBox={`0 0 ${VIEW_W} ${RIBBON_H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {stages.slice(0, -1).map((stage, index) => {
            const a = height(stage.count) * 0.62;
            const b = height(stages[index + 1].count) * 0.62;
            const x1 = x(index) + NODE_W;
            const x2 = x(index + 1);
            const cx = (x1 + x2) / 2;
            return (
              <path
                key={stage.id}
                d={`M${x1} ${MID - a / 2} C${cx} ${MID - a / 2} ${cx} ${MID - b / 2} ${x2} ${MID - b / 2} L${x2} ${MID + b / 2} C${cx} ${MID + b / 2} ${cx} ${MID + a / 2} ${x1} ${MID + a / 2}Z`}
              />
            );
          })}
        </svg>
        <ol className={styles.nodes}>
          {stages.map((stage, index) => {
            const h = height(stage.count);
            const on = selected === stage.id;
            return (
              <li
                key={stage.id}
                className={styles.nodeSlot}
                style={{ left: pct(x(index) - gap * 0.45), width: pct(NODE_W + gap * 0.9) }}
              >
                <button
                  type="button"
                  className={cx(styles.node, on && styles.nodeOn)}
                  aria-pressed={on}
                  aria-label={`${stage.label}: ${stage.count}, ${stage.caption.toLowerCase()}. Show this stage below.`}
                  data-testid={`ward-statistics-journey-node-${stage.id}`}
                  onClick={() => onSelect(stage.id)}
                  style={
                    {
                      "--node-top": `${MID - h / 2}px`,
                      "--node-h": `${h}px`,
                      "--node-w": `${(NODE_W / (NODE_W + gap * 0.9)) * 100}%`,
                    } as CSSProperties
                  }
                >
                  <span className={styles.nodeCount}>{stage.count}</span>
                  <span className={styles.nodeBox} aria-hidden="true" />
                  <span className={styles.nodeLabel}>
                    <StatusGlyph tone={stage.tone} size={9} />
                    {stage.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

type HospitalRow = {
  code: string;
  name: string;
  wards: number;
  beds: number;
  ready: number;
  pulled: number;
  closed: number;
  occupied: number;
};

export function StatisticsJourneyView({ onShowBoard }: { onShowBoard: () => void }) {
  const { units, admissions, bedReleases, leaveBeds, movements } = useWardFlow();
  const now = useWardFlowClock();
  const [selected, setSelected] = useState<JourneyStageId | null>(null);

  const stages = useMemo(
    () => journeyStages({ units, admissions, bedReleases, leaveBeds, movements, now }),
    [units, admissions, bedReleases, leaveBeds, movements, now],
  );

  const hospitals = useMemo(() => {
    const bySite = new Map<string, HospitalRow>();
    for (const unit of units) {
      const states = bedStates(unit, admissions, bedReleases, leaveBeds);
      const row = bySite.get(unit.siteCode) ?? {
        code: unit.siteCode,
        name: shortSiteName(siteByCode(unit.siteCode)?.name ?? unit.siteCode),
        wards: 0,
        beds: 0,
        ready: 0,
        pulled: 0,
        closed: 0,
        occupied: 0,
      };
      row.wards += 1;
      row.beds += unit.beds;
      row.ready += states.ready;
      row.pulled += states.pulled;
      row.closed += states.closed;
      row.occupied += states.occupied;
      bySite.set(unit.siteCode, row);
    }
    return [...bySite.values()]
      .filter((row) => row.ready > 0)
      .sort((a, b) => b.ready - a.ready || a.name.localeCompare(b.name));
  }, [units, admissions, bedReleases, leaveBeds]);

  const waitingRows = useMemo<EdSwarmRow[]>(
    () =>
      allEmergencyDepartments()
        .map((ed) => {
          const figures = edWaitFigures(movements, ed.id, now);
          return {
            id: ed.id,
            // The short ED name ("SCGH", "Midland"), so the name fits the field's label column.
            name: edShortName(ed).replace(/ ED$/, ""),
            href: edStatisticsHref(ed.id),
            entries: figures.waitingMovements,
            longest: figures.longestWait?.waitMinutes ?? 0,
          };
        })
        .filter((row) => row.entries.length > 0)
        .sort((a, b) => b.entries.length - a.entries.length || b.longest - a.longest)
        .map(({ id, name, href, entries }) => ({ id, name, href, entries })),
    [movements, now],
  );
  const totalWaiting = waitingRows.reduce((sum, row) => sum + row.entries.length, 0);
  const totalReady = hospitals.reduce((sum, row) => sum + row.ready, 0);
  const totalPreparing = units.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, bedReleases), 0);

  function select(id: JourneyStageId) {
    const next = selected === id ? null : id;
    setSelected(next);
    if (next) document.getElementById(`journey-stage-${next}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return (
    <section id="journey" aria-label="Journey" data-testid="ward-statistics-journey-view" className={styles.view}>
      <StatCard
        id="journey-ribbon"
        icon={Route}
        title="Where people are now"
        aside={<span className={styles.aside}>Choose a stage to see its breakdown</span>}
        data-testid="ward-statistics-journey-ribbon"
      >
        <CardBody className={styles.ribbonBody}>
          <JourneyRibbon stages={stages} selected={selected} onSelect={select} />
        </CardBody>
      </StatCard>

      <StatCard
        id="journey-stages"
        icon={Columns3}
        title="Each stage"
        aside={<span className={styles.aside}>Whole network</span>}
        data-testid="ward-statistics-journey-stages"
      >
        <CardBody>
          <ol className={styles.band}>
            {stages.map((stage) => (
              <li
                key={stage.id}
                id={`journey-stage-${stage.id}`}
                className={cx(styles.stage, selected === stage.id && styles.stageOn)}
                data-testid={`ward-statistics-journey-stage-${stage.id}`}
                aria-current={selected === stage.id ? "true" : undefined}
              >
                <div className={styles.stageHead}>
                  <h3 className={styles.stageLabel}>
                    <StatusGlyph tone={stage.tone} size={9} />
                    {stage.label}
                  </h3>
                  <p className={styles.stageFigure} data-testid={`ward-statistics-journey-stage-${stage.id}-count`}>
                    {stage.count}
                  </p>
                  <p className={styles.stageCaption}>{stage.caption}</p>
                </div>
                <dl className={styles.breakdown}>
                  {stage.breakdown.map((item) => (
                    <div key={item.label} className={styles.breakdownRow}>
                      <dt>{item.label}</dt>
                      <dd>
                        {item.tone ? <StatusGlyph tone={item.tone} size={9} /> : null}
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>
        </CardBody>
      </StatCard>

      <FlushRow layout="halves">
        <StatCard
          id="journey-beds"
          icon={BedDouble}
          title="Where is a bed"
          meta={totalPreparing > 0 ? `${totalReady} ready, ${totalPreparing} being made ready` : `${totalReady} ready`}
          action={
            <Button size="sm" variant="sec" onClick={onShowBoard} data-testid="ward-statistics-journey-open-board">
              Bed board
            </Button>
          }
          data-testid="ward-statistics-journey-beds"
        >
          <CardBody className={styles.bedsBody}>
            <div className={styles.bedsKey}>
              <span role="group" aria-label="Bed status legend">
                <Legend
                  items={[
                    { id: "occupied", label: BED_STATE_LABELS.occupied, fill: "data-3" },
                    { id: "pulled", label: BED_STATE_LABELS.pulled, hatch: true },
                    { id: "closed", label: BED_STATE_LABELS.closed, fill: "data-2" },
                    { id: "ready", label: BED_STATE_LABELS.ready, fill: "data-1" },
                  ]}
                />
              </span>
              <span className={styles.lineKey}>
                <span className={styles.lineSwatch} aria-hidden="true" />
                {BED_ALERT_THRESHOLD_PERCENT}%
              </span>
            </div>
            {hospitals.length === 0 ? (
              <p className={styles.empty}>No ready beds across the network right now.</p>
            ) : (
              <div className={styles.hospitals}>
                <div className={styles.hospitalHead} aria-hidden="true">
                  <span>Hospital</span>
                  <span className={styles.ticks}>
                    <span style={{ left: "0%" }}>0%</span>
                    <span style={{ left: "50%" }}>50%</span>
                    <span style={{ left: "100%" }}>100%</span>
                  </span>
                  <span className={styles.readyHead}>Ready</span>
                </div>
                <ul className={styles.hospitalList}>
                  {hospitals.map((row) => {
                    const share = (value: number) => `${(value / (row.beds || 1)) * 100}%`;
                    const occupancy = row.beds ? ((row.occupied + row.pulled) / row.beds) * 100 : 0;
                    const over = occupancy >= BED_ALERT_THRESHOLD_PERCENT;
                    return (
                      <li key={row.code}>
                        <button
                          type="button"
                          className={styles.hospitalRow}
                          onClick={onShowBoard}
                          data-testid={`ward-statistics-journey-hospital-${row.code}`}
                          aria-label={`${row.name}: ${row.ready} ready, ${row.pulled} pulled, ${row.closed} closed, ${row.occupied} occupied of ${row.beds} beds${over ? `, at or over ${BED_ALERT_THRESHOLD_PERCENT}%` : ""}. Open the bed board.`}
                        >
                          <span className={styles.hospitalName}>
                            <strong title={row.name}>{row.name}</strong>
                            <small>
                              {row.wards} {row.wards === 1 ? "ward" : "wards"} · {row.beds} beds
                            </small>
                          </span>
                          <span className={styles.barArea} aria-hidden="true">
                            <i className={styles.guide} style={{ left: "50%" }} />
                            <span className={styles.bar}>
                              {row.occupied > 0 ? (
                                <span className={styles.occupied} style={{ width: share(row.occupied) }} />
                              ) : null}
                              {row.pulled > 0 ? (
                                <span className={styles.pulled} style={{ width: share(row.pulled) }} />
                              ) : null}
                              {row.closed > 0 ? (
                                <span className={styles.closed} style={{ width: share(row.closed) }} />
                              ) : null}
                              <span className={styles.ready} style={{ width: share(row.ready) }} />
                            </span>
                            <i className={styles.alertMark} style={{ left: `${BED_ALERT_THRESHOLD_PERCENT}%` }} />
                          </span>
                          <span className={styles.readyCount}>
                            {over ? <StatusGlyph tone="warning" size={9} /> : null}
                            {row.ready}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardBody>
        </StatCard>

        <Follow>
          <StatCard
            id="journey-waiting"
            icon={Clock}
            title="Who is waiting"
            meta={`${totalWaiting} in ${waitingRows.length} ${waitingRows.length === 1 ? "ED" : "EDs"}`}
            data-testid="ward-statistics-journey-waiting"
          >
            <CardBody>
              {waitingRows.length === 0 ? (
                <p className={styles.empty}>Nobody is waiting in an ED for a bed right now.</p>
              ) : (
                <StatisticsEdSwarm
                  rows={waitingRows}
                  labelWidth={128}
                  testId="ward-statistics-journey-swarm"
                  label="Each person waiting in ED, by department and how long they have waited"
                />
              )}
              <SrOnly>Each row opens that ED&apos;s statistics.</SrOnly>
            </CardBody>
          </StatCard>
        </Follow>
      </FlushRow>
    </section>
  );
}
