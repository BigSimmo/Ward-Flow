"use client";

/**
 * The three graphs under the Delays table. Each one filters the table rather than drilling into
 * a page of its own: a lane label, a matrix cell or a half-hour column narrows the table, and a
 * dot opens that person's row. Everything is drawn from the same rows the table shows.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { StatusGlyph } from "@/components/wf";
import { DELAY_CAUSE_ORDER, SEVERE_CAUSES, type DelayCause, type DelayOwnerId } from "./delays-derivations";
import type { CatchmentOrigin } from "./delays-view-model";
import {
  BOARD_OWNERS,
  H24,
  H8,
  RUNWAY_WINDOW,
  hoursWord,
  OVER_24H,
  OVER_8H,
  SPREAD_TICKS,
  WAIT_BANDS,
  bandCounts,
  catchmentName,
  hasFilters,
  projectedOver8,
  rowTone,
  spreadX,
  type BoardFilters,
  type BoardRow,
  type RunwayBin,
} from "./delays-board-model";
import { BandBar, causeTitle } from "./delays-board-parts";
import { currentDueSoonThresholds } from "@/components/ward-management/ward-clock";
import styles from "./delays-board.module.css";

type Graph = "spread" | "runway" | "matrix";

const SHORT_CAUSE: Record<DelayCause, string> = {
  legal_breached: "Form overdue",
  legal_expiring: "Form due",
  no_eligible_bed: "No bed",
  awaiting_ward_answer: "Ward answer",
  bed_pull_expired: "Time passed",
  awaiting_bed_ready: "Bed ready",
  awaiting_transport: "Transport",
  patient_or_family: "Family",
  awaiting_coordinator: "On you",
};

type Props = {
  rows: BoardRow[];
  shown: BoardRow[];
  bins: RunwayBin[];
  now: Instant;
  filters: BoardFilters;
  catchments: CatchmentOrigin[];
  selectedId: string | null;
  onFilters: (patch: Partial<BoardFilters>, toFlat?: boolean) => void;
  onClear: () => void;
  onPick: (id: string) => void;
  onToTable: () => void;
};

type Tip = { x: number; y: number; body: ReactNode } | null;

const hoursOrDuration = (minutes: number) => (minutes % 60 === 0 ? `${minutes / 60}h` : splitDuration(minutes));

/** Assumed plot width for keeping dots apart; the plot itself is fluid. */
/** Width assumed before the plot is measured (and in jsdom); the real width replaces it. */
const ASSUMED_PLOT_WIDTH = 900;
const DOT = 15;

function Spread({
  rows,
  shown,
  filters,
  catchments,
  selectedId,
  lanes,
  onFilters,
  onPick,
  onTip,
}: Pick<Props, "rows" | "shown" | "filters" | "catchments" | "selectedId" | "onFilters" | "onPick"> & {
  lanes: "owner" | "origin";
  onTip: (event: React.MouseEvent | null, body?: ReactNode) => void;
}) {
  const patientOf = usePatientOf();
  // Dots are kept apart in real pixels, so measure the plot rather than assume its width.
  const measureRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(ASSUMED_PLOT_WIDTH);
  useEffect(() => {
    const plot = measureRef.current;
    if (plot === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (plot.clientWidth > 0) setPlotWidth(plot.clientWidth);
    });
    observer.observe(plot);
    return () => observer.disconnect();
  }, []);
  const PLOT_WIDTH = plotWidth;
  const visible = new Set(shown.map((row) => row.movement.id));
  const anyFilter = visible.size !== rows.length;
  const laneList =
    lanes === "owner"
      ? BOARD_OWNERS.map((owner) => ({
          id: owner.id as string,
          label: owner.name,
          pressed: filters.owner === owner.id,
          rows: rows.filter((row) => row.owner === owner.id),
          press: () => onFilters({ owner: filters.owner === owner.id ? null : owner.id, cause: null }),
        }))
      : catchments.map((origin) => ({
          id: origin as string,
          label: catchmentName(origin),
          pressed: filters.origin === origin,
          rows: rows.filter((row) => row.origin === origin),
          press: () => onFilters({ origin: filters.origin === origin ? null : origin }),
        }));
  const grid = (
    <>
      {[240, 720, 960, 1200].map((minutes) => (
        <span key={minutes} className={styles.gGrid} style={{ left: `${spreadX(minutes)}%` }} />
      ))}
      <span className={styles.g8} style={{ left: `${spreadX(OVER_8H)}%` }} />
      <span className={styles.gBeyond} style={{ left: `${spreadX(OVER_24H)}%` }} />
    </>
  );
  return (
    <div className={styles.gDots}>
      {laneList.map((lane, laneIndex) => {
        const sorted = [...lane.rows].sort((a, b) => b.waited - a.waited);
        const placed: { x: number; y: number; row: BoardRow }[] = [];
        for (const row of sorted) {
          const x = (spreadX(row.waited) / 100) * PLOT_WIDTH;
          // Nearest free slot, alternating above and below, however many share a wait.
          let y = 0;
          for (let step = 0; ; step += 1) {
            const k = step % 2 === 0 ? step / 2 : -(step + 1) / 2;
            const candidate = k * DOT;
            if (!placed.some((p) => Math.abs(p.x - x) < DOT && p.y === candidate)) {
              y = candidate;
              break;
            }
          }
          placed.push({ x, y, row });
        }
        const spreadY = Math.max(0, ...placed.map((p) => Math.abs(p.y)));
        const height = Math.max(56, spreadY * 2 + 34);
        const over8 = lane.rows.filter((row) => row.waited >= OVER_8H).length;
        return (
          <div key={lane.id} className={styles.gLane}>
            <button
              type="button"
              className={styles.gLaneL}
              aria-pressed={lane.pressed}
              aria-label={`${lane.label}, ${lane.rows.length} waiting, ${over8} over ${H8}. Filter the table`}
              onClick={lane.press}
            >
              <b>{lane.label}</b>
              <small>
                <span className={styles.num}>{lane.rows.length}</span> waiting
                {over8 > 0 ? (
                  <>
                    {" · "}
                    <StatusGlyph tone="warning" size={9} />
                    <span className={styles.num}>{over8}</span> {`over ${H8}`}
                  </>
                ) : null}
              </small>
            </button>
            <div className={styles.gPlot} style={{ height }} ref={laneIndex === 0 ? measureRef : undefined}>
              {grid}
              {placed.map(({ x, y, row }) => {
                const name = patientOf(row.movement).formalName;
                const label = `${name}, waited ${splitDuration(row.waited)}, ${causeTitle(row.cause)}`;
                return (
                  <button
                    key={row.movement.id}
                    type="button"
                    className={`${styles.gDot} ${anyFilter && !visible.has(row.movement.id) ? styles.dim : ""}`}
                    aria-pressed={selectedId === row.movement.id}
                    aria-label={label}
                    style={{ left: `${(x / PLOT_WIDTH) * 100}%`, top: `calc(50% + ${y}px)` }}
                    onClick={() => {
                      onTip(null);
                      onPick(row.movement.id);
                    }}
                    onMouseMove={(event) =>
                      onTip(
                        event,
                        <>
                          <b>{name}</b>
                          <br />
                          <span className={styles.num}>{splitDuration(row.waited)}</span>
                          {` · ${causeTitle(row.cause)}`}
                          {row.dueIn !== undefined && row.movement.legalForm ? (
                            <>
                              <br />
                              {`Form ${row.movement.legalForm.code} ${row.dueIn < 0 ? "overdue" : "due in"} `}
                              <span className={styles.num}>{splitDuration(Math.abs(row.dueIn))}</span>
                            </>
                          ) : null}
                        </>,
                      )
                    }
                    onMouseLeave={() => onTip(null)}
                  >
                    <StatusGlyph tone={rowTone(row)} size={10} />
                  </button>
                );
              })}
              {lane.rows.length === 0 ? <span className={`${styles.mute} ${styles.gNone}`}>Nobody waiting</span> : null}
            </div>
          </div>
        );
      })}
      <div className={`${styles.gLane} ${styles.gAxis}`} aria-hidden="true">
        <span />
        <div className={styles.gTicks}>
          {SPREAD_TICKS.map(([minutes, label]) => (
            <span key={label} style={{ left: `${spreadX(minutes)}%` }}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Runway({
  rows,
  bins,
  now,
  filters,
  onFilters,
  onTip,
}: Pick<Props, "rows" | "bins" | "now" | "filters" | "onFilters"> & {
  onTip: (event: React.MouseEvent | null, body?: ReactNode) => void;
}) {
  const W = 1100;
  const H = 200;
  const L = 44;
  const R = 16;
  const T = 14;
  const B = 28;
  const barWidth = 64;
  const pw = W - L - R;
  const ph = H - T - B;
  const max = Math.max(0, ...bins.map((bin) => bin.cross8.length + bin.cross24.length + bin.formDue.length));
  const ymax = Math.max(3, Math.ceil(max / 3) * 3);
  const y = (v: number) => T + ph - (v / ymax) * ph;
  const xc = (i: number) => L + (pw * (i + 0.5)) / bins.length;
  const projection = projectedOver8(rows, bins);
  const ptop = 26;
  const pH = 54;
  const lo = projection[0] - 2;
  const hi = projection[projection.length - 1] + 2;
  const py = (v: number) => ptop + pH - ((v - lo) / Math.max(1, hi - lo)) * pH;
  let path = `M${L},${py(projection[0])}`;
  projection.slice(1).forEach((v, i) => {
    path += ` H${L + (pw * (i + 1)) / bins.length} V${py(v)}`;
  });
  const at = (minutes: number) => formatInstantWithDay(now + minutes, now);
  const last = projection[projection.length - 1];
  return (
    <div className={styles.gRw}>
      <svg
        className={styles.rwSvg}
        viewBox={`0 0 ${W} ${H + 96}`}
        role="group"
        aria-label={`People crossing ${H8} or ${H24} and recorded legal times falling due in each half hour for the next ${hoursWord(RUNWAY_WINDOW)}`}
      >
        <text x={L} y={12} className={styles.rwCap}>
          {`Over ${H8} if nobody moves`}
        </text>
        <line x1={L} x2={L + pw} y1={ptop + pH} y2={ptop + pH} className={styles.rwGrid} />
        <path d={path} className={styles.rwProj} />
        <circle cx={L} cy={py(projection[0])} r={4} className={styles.rwDot} />
        <text x={L + 8} y={py(projection[0]) - 8} className={styles.rwLbl}>
          {`${projection[0]} now`}
        </text>
        <circle cx={L + pw} cy={py(last)} r={4} className={styles.rwDot} />
        <text x={L + pw - 8} y={py(last) - 8} textAnchor="end" className={styles.rwLbl}>
          {`${last} by ${at(RUNWAY_WINDOW)}`}
        </text>
        <g transform="translate(0,96)">
          {[0, 1, 2, 3].map((g) => {
            const v = (ymax / 3) * g;
            return (
              <g key={g}>
                <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} className={styles.rwGrid} />
                <text x={L - 10} y={y(v) + 4} textAnchor="end" className={styles.rwAx}>
                  {v}
                </text>
              </g>
            );
          })}
          {bins.map((bin) => {
            const total = bin.cross8.length + bin.cross24.length + bin.formDue.length;
            const on = filters.bin === bin.index;
            const label = `${at(bin.from)} to ${at(bin.to)}: ${bin.cross8.length} cross ${H8}, ${bin.cross24.length} cross ${H24}, ${bin.formDue.length} recorded legal times due`;
            let acc = 0;
            const press = () => onFilters({ bin: on ? null : bin.index }, !on);
            return (
              <g
                key={bin.index}
                className={`${styles.rwCol} ${on ? styles.rwOn : ""}`}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={label}
                onClick={press}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    press();
                  }
                }}
                onMouseMove={(event) =>
                  onTip(
                    event,
                    <>
                      <b className={styles.num}>{`${at(bin.from)} to ${at(bin.to)}`}</b>
                      <br />
                      {`${bin.cross8.length} cross ${H8} · ${bin.cross24.length} cross ${H24} · ${bin.formDue.length} form due`}
                    </>,
                  )
                }
                onMouseLeave={() => onTip(null)}
              >
                <rect
                  x={xc(bin.index) - pw / 16 + 4}
                  y={T - 6}
                  width={pw / bins.length - 8}
                  height={ph + 6}
                  rx={16}
                  className={styles.rwHit}
                />
                {(
                  [
                    [bin.cross8.length, styles.r8],
                    [bin.cross24.length, styles.r24],
                    [bin.formDue.length, styles.rf],
                  ] as const
                ).map(([n, cls]) => {
                  if (n === 0) return null;
                  const h = (n / ymax) * ph - 2;
                  const rect = (
                    <rect
                      key={cls}
                      x={xc(bin.index) - barWidth / 2}
                      y={y(acc + n) + 1}
                      width={barWidth}
                      height={Math.max(h, 4)}
                      rx={8}
                      className={cls}
                    />
                  );
                  acc += n;
                  return rect;
                })}
                <text
                  x={xc(bin.index)}
                  y={total ? y(total) - 8 : y(0) - 8}
                  textAnchor="middle"
                  className={total ? styles.rwLbl : styles.rwAx}
                >
                  {total}
                </text>
                <text x={xc(bin.index)} y={H - 6} textAnchor="middle" className={styles.rwAx}>
                  {at(bin.from)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function Matrix({
  rows,
  filters,
  catchments,
  cols,
  onFilters,
  onTip,
}: Pick<Props, "rows" | "filters" | "catchments" | "onFilters"> & {
  cols: "owner" | "cause";
  onTip: (event: React.MouseEvent | null, body?: ReactNode) => void;
}) {
  const patientOf = usePatientOf();
  const byOwner = cols === "owner";
  const columns = byOwner
    ? BOARD_OWNERS.map((owner) => ({
        id: owner.id as string,
        label: owner.name,
        severe: false,
        match: (row: BoardRow) => row.owner === owner.id,
      }))
    : DELAY_CAUSE_ORDER.filter((cause) => rows.some((row) => row.cause === cause)).map((cause) => ({
        id: cause as string,
        label: SHORT_CAUSE[cause],
        severe: SEVERE_CAUSES.includes(cause),
        match: (row: BoardRow) => row.cause === cause,
      }));
  const max = Math.max(
    1,
    ...catchments.flatMap((origin) =>
      columns.map((column) => rows.filter((row) => row.origin === origin && column.match(row)).length),
    ),
  );
  const isOn = (origin: CatchmentOrigin, id: string) =>
    filters.origin === origin && (byOwner ? filters.owner === id && filters.cause === null : filters.cause === id);
  const press = (origin: CatchmentOrigin, id: string) => {
    if (isOn(origin, id)) onFilters({ origin: null, owner: null, cause: null });
    else if (byOwner) onFilters({ origin, owner: id as DelayOwnerId, cause: null });
    else onFilters({ origin, cause: id as DelayCause, owner: null });
  };
  return (
    <div className={styles.gMx}>
      <div
        className={styles.mxG}
        style={{
          gridTemplateColumns: `minmax(7.5rem, 8rem) repeat(${columns.length}, minmax(4.5rem, 1fr)) minmax(5rem, 6rem)`,
        }}
      >
        <span />
        {columns.map((column) => (
          <span key={column.id} className={styles.mxH}>
            {column.severe ? <StatusGlyph tone="danger" size={9} /> : null}
            {column.label}
          </span>
        ))}
        <span className={styles.mxH}>All</span>
        {catchments.map((origin) => {
          const inOrigin = rows.filter((row) => row.origin === origin);
          return [
            <span key={`${origin}-label`} className={styles.mxR}>
              <b>{catchmentName(origin)}</b>
              <small className={styles.mute}>{`${inOrigin.length} waiting`}</small>
            </span>,
            ...columns.map((column) => {
              const cell = inOrigin.filter(column.match);
              const n = cell.length;
              const over8 = cell.filter((row) => row.waited >= OVER_8H).length;
              const on = isOn(origin, column.id);
              const strength = n ? Math.round(5 + (n / max) * 28) : 0;
              return (
                <button
                  key={`${origin}-${column.id}`}
                  type="button"
                  className={`${styles.mxC} ${on ? styles.mxOn : ""} ${n === 0 ? styles.mxZero : ""}`}
                  aria-pressed={on}
                  aria-label={`${catchmentName(origin)}, ${column.label}: ${n} waiting, ${over8} over ${H8}`}
                  disabled={n === 0 && !on}
                  style={
                    n
                      ? { background: `color-mix(in srgb, var(--wf-accent) ${strength}%, var(--wf-surface))` }
                      : undefined
                  }
                  onClick={() => press(origin, column.id)}
                  onMouseMove={(event) =>
                    onTip(
                      event,
                      <>
                        <b>{`${catchmentName(origin)} · ${column.label}`}</b>
                        <br />
                        {`${n} waiting`}
                        {cell.slice(0, 3).map((row) => (
                          <span key={row.movement.id}>
                            <br />
                            {`${patientOf(row.movement).formalName} · ${splitDuration(row.waited)}`}
                          </span>
                        ))}
                      </>,
                    )
                  }
                  onMouseLeave={() => onTip(null)}
                >
                  <span className={styles.mxTop}>
                    <span className={`${styles.mxN} ${styles.num}`}>{n}</span>
                    {over8 > 0 ? (
                      <span className={styles.mxO}>
                        <StatusGlyph tone="warning" size={9} />
                        <span className={styles.num}>{over8}</span>
                      </span>
                    ) : null}
                  </span>
                  <BandBar bands={bandCounts(cell)} />
                </button>
              );
            }),
            <span key={`${origin}-total`} className={styles.mxT}>
              <span className={styles.num}>{inOrigin.length}</span>
              <BandBar bands={bandCounts(inOrigin)} />
            </span>,
          ];
        })}
        <span className={styles.mxR}>
          <b>All</b>
        </span>
        {columns.map((column) => {
          const list = rows.filter(column.match);
          return (
            <span key={`all-${column.id}`} className={styles.mxT}>
              <span className={styles.num}>{list.length}</span>
              <BandBar bands={bandCounts(list)} />
            </span>
          );
        })}
        <span className={styles.mxT}>
          <span className={styles.num}>{rows.length}</span>
          <BandBar bands={bandCounts(rows)} />
        </span>
      </div>
    </div>
  );
}

export function DelaysBoardGraphs(props: Props) {
  const { rows, shown, filters, onFilters, onClear, onToTable } = props;
  const [graph, setGraph] = useState<Graph>("spread");
  const [lanes, setLanes] = useState<"owner" | "origin">("owner");
  const [cols, setCols] = useState<"owner" | "cause">("owner");
  const [tip, setTip] = useState<Tip>(null);
  const onTip = (event: React.MouseEvent | null, body?: ReactNode) => {
    if (event === null || body === undefined) {
      setTip(null);
      return;
    }
    setTip({ x: event.clientX, y: event.clientY, body });
  };
  const tabs: { id: Graph; label: string }[] = [
    { id: "spread", label: "Wait spread" },
    { id: "runway", label: `Next ${hoursWord(RUNWAY_WINDOW)}` },
    { id: "matrix", label: "Where and whose move" },
  ];
  const onTabKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((entry) => entry.id === graph);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : -1;
    if (next < 0) return;
    event.preventDefault();
    setGraph(tabs[next].id);
    window.requestAnimationFrame(() => document.getElementById(`delays-graph-tab-${tabs[next].id}`)?.focus());
  };

  const { urgentMinutes, soonMinutes } = currentDueSoonThresholds();
  const legend =
    graph === "spread" ? (
      <>
        <span className={styles.lg}>
          <StatusGlyph tone="danger" size={9} />
          {`Over ${H24}, or recorded legal time within ${hoursOrDuration(urgentMinutes)}`}
        </span>
        <span className={styles.lg}>
          <StatusGlyph tone="warning" size={9} />
          {`Over ${H8}, or recorded legal time within ${hoursOrDuration(soonMinutes)}`}
        </span>
        <span className={styles.lg}>
          <StatusGlyph tone="neutral" size={9} />
          Waiting
        </span>
        <span className={styles.lg}>
          <span className={styles.lg8} />
          {`${H8} mark`}
        </span>
        <span className={styles.lg}>
          <span className={styles.lgZ} />
          {`Past ${H24}, compressed to 7d`}
        </span>
      </>
    ) : graph === "runway" ? (
      <>
        <span className={styles.lg}>
          <i className={styles.band2} />
          {`Crosses ${H8}`}
        </span>
        <span className={styles.lg}>
          <i className={styles.band3} />
          {`Crosses ${H24}`}
        </span>
        <span className={styles.lg}>
          <i className={styles.keyAccent} />
          Recorded legal time due
        </span>
        <span className={styles.lg}>
          <span className={`${styles.lg8} ${styles.lg8Amber}`} />
          {`Over ${H8} if nobody moves`}
        </span>
      </>
    ) : (
      <>
        {WAIT_BANDS.map((band, index) => (
          <span key={band} className={styles.lg}>
            <i className={styles[`band${index}`]} />
            {band}
          </span>
        ))}
        <span className={styles.lg}>
          <StatusGlyph tone="warning" size={9} />
          {`Over ${H8} in that cell`}
        </span>
      </>
    );

  const sub =
    graph === "spread" ? (
      <>
        <span className={styles.eyebrow}>Rows</span>
        <div className={styles.seg} role="group" aria-label="Spread rows">
          <button type="button" aria-pressed={lanes === "owner"} onClick={() => setLanes("owner")}>
            Whose move
          </button>
          <button type="button" aria-pressed={lanes === "origin"} onClick={() => setLanes("origin")}>
            Catchment
          </button>
        </div>
      </>
    ) : graph === "matrix" ? (
      <>
        <span className={styles.eyebrow}>Columns</span>
        <div className={styles.seg} role="group" aria-label="Matrix columns">
          <button
            type="button"
            aria-pressed={cols === "owner"}
            onClick={() => {
              setCols("owner");
              onFilters({ cause: null });
            }}
          >
            Whose move
          </button>
          <button
            type="button"
            aria-pressed={cols === "cause"}
            onClick={() => {
              setCols("cause");
              onFilters({ cause: null, owner: null });
            }}
          >
            Blocker
          </button>
        </div>
      </>
    ) : null;

  return (
    <section className={`${styles.card} ${styles.gCard}`} aria-label="Delay graphs" data-ward-primitive="panel">
      <div className={styles.chead}>
        <div className={`${styles.seg} ${styles.gTabs}`} role="tablist" aria-label="Delay graph" onKeyDown={onTabKey}>
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`delays-graph-tab-${entry.id}`}
              aria-controls="delays-graph-panel"
              aria-selected={graph === entry.id}
              tabIndex={graph === entry.id ? 0 : -1}
              onClick={() => setGraph(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <span className={styles.sp} />
        {sub}
      </div>
      <div className={`${styles.legend} ${styles.gLegend}`}>{legend}</div>
      <div
        id="delays-graph-panel"
        role="tabpanel"
        aria-labelledby={`delays-graph-tab-${graph}`}
        className={styles.gScroll}
      >
        {graph === "spread" ? (
          <Spread {...props} lanes={lanes} onTip={onTip} />
        ) : graph === "runway" ? (
          <Runway {...props} onTip={onTip} />
        ) : (
          <Matrix {...props} cols={cols} onTip={onTip} />
        )}
      </div>
      {hasFilters(filters) ? (
        <div className={styles.gFoot}>
          <span>
            <b className={styles.num}>{shown.length}</b>
            {` of ${rows.length} match the current filters and are shown in the table.`}
          </span>
          <span className={styles.sp} />
          <button type="button" className={styles.lnk} onClick={onToTable}>
            Go to the table
          </button>
          <button type="button" className={styles.lnk} onClick={onClear}>
            Clear
          </button>
        </div>
      ) : null}
      {tip ? (
        <div
          className={styles.tip}
          role="presentation"
          style={{
            left: Math.min(tip.x + 14, (typeof window === "undefined" ? 1440 : window.innerWidth) - 292),
            top: tip.y + 16,
          }}
        >
          {tip.body}
        </div>
      ) : null}
    </section>
  );
}
