"use client";

// Fork of src/components/ward-management/delays/delays-board-graphs.tsx. Decision 1 (Josh, 30 Oct
// 2026): a dot's tip names the recorded form time as typed, with its warning words, never a countdown.

/**
 * The three graphs under the Delays table. Each one filters the table rather than drilling into
 * a page of its own: a lane label, a matrix cell or a half-hour column narrows the table, and a
 * dot opens that person's row. Every graph draws everyone waiting: the spread dims the dots a
 * filter hides, while the runway and the matrix keep counting everyone so the whole picture stays.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { formatInstantWithDay, type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { StatusGlyph } from "@/components/wf";
import {
  DELAY_CAUSE_ORDER,
  SEVERE_CAUSES,
  type DelayCause,
  type DelayOwnerId,
} from "@/components/ward-management/delays/delays-derivations";
import type { CatchmentOrigin } from "@/components/ward-management/delays/delays-view-model";
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
  rowTone,
  spreadX,
  type BoardFilters,
  type BoardRow,
  type RunwayBin,
} from "@/components/ward-management/delays/delays-board-model";
import { BandBar } from "@/components/ward-management/delays/delays-board-parts";
import { waitingCauseTitle as causeTitle } from "./wait-bands";
import styles from "@/components/ward-management/delays/delays-board.module.css";
import polish from "./waiting-polish.module.css";
import { NextCrossings } from "./waiting-next-crossings";

import { useDueSoonThresholds } from "@/components/ward-management/ward-flow-provider";
import { standingSuffix, typedTimeStanding } from "@/components/ward-redesign/legal-forms/typed-time-words";
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
/** Round 4: the most dots stacked at one wait before the pile says "+n". */
const STACK = 5;

function LaneLabel({ label, count, over8 }: { label: string; count: number; over8: number }) {
  return (
    <>
      <b>{label}</b>
      <small>
        <span className={styles.num}>{count}</span> waiting
        {over8 > 0 ? (
          <>
            {" · "}
            <StatusGlyph tone="warning" size={9} />
            <span className={styles.num}>{over8}</span> {`over ${H8}`}
          </>
        ) : null}
      </small>
    </>
  );
}

function Spread({
  rows,
  now,
  shown,
  filters,
  catchments,
  selectedId,
  lanes,
  onFilters,
  onPick,
  onTip,
}: Pick<Props, "rows" | "now" | "shown" | "filters" | "catchments" | "selectedId" | "onFilters" | "onPick"> & {
  lanes: "owner" | "origin";
  onTip: (event: React.MouseEvent | null, body?: ReactNode) => void;
}) {
  const thresholds = useDueSoonThresholds();
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
    return () => {
      observer.disconnect();
    };
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
          press: () => {
            onFilters({ owner: filters.owner === owner.id ? null : owner.id, cause: null });
          },
        }))
      : catchments.map((origin) => ({
          id: origin as string,
          label: catchmentName(origin),
          pressed: filters.origin === origin,
          rows: rows.filter((row) => row.origin === origin),
          press: () => {
            onFilters({ origin: filters.origin === origin ? null : origin });
          },
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
        const overflow: { x: number; n: number; laneIndex: number }[] = [];
        for (const row of sorted) {
          // Clamped so a dot at 0h or 7d keeps its whole circle inside the lane.
          const x = Math.min(PLOT_WIDTH - DOT / 2, Math.max(DOT / 2, (spreadX(row.waited) / 100) * PLOT_WIDTH));
          // Round 4: dots stack upward from one baseline, at most STACK high; a taller pile ends in
          // a "+n" so a crowd of short waits no longer towers over the lane.
          let y = -1;
          for (let step = 0; step < STACK; step += 1) {
            if (!placed.some((p) => Math.abs(p.x - x) < DOT && p.y === step)) {
              y = step;
              break;
            }
          }
          if (y < 0) {
            const pile = overflow.find((o) => Math.abs(o.x - x) < DOT);
            if (pile) pile.n += 1;
            else overflow.push({ x, n: 1, laneIndex });
            continue;
          }
          placed.push({ x, y, row });
        }
        const rowsUsed = Math.max(1, ...placed.map((p) => p.y + 1));
        const height = rowsUsed * DOT + 26;
        const over8 = lane.rows.filter((row) => row.waited >= OVER_8H).length;
        return (
          <div key={lane.id} className={styles.gLane}>
            {/* An empty lane is a label, not a filter that would empty the table. An already pressed
                one stays a button so its filter can still be removed. */}
            {lane.rows.length > 0 || lane.pressed ? (
              <button
                type="button"
                className={styles.gLaneL}
                aria-pressed={lane.pressed}
                aria-label={`${lane.label}, ${lane.rows.length} waiting, ${over8} over ${H8}. Filter the table`}
                onClick={lane.press}
              >
                <LaneLabel label={lane.label} count={lane.rows.length} over8={over8} />
              </button>
            ) : (
              <div className={styles.gLaneL}>
                <LaneLabel label={lane.label} count={0} over8={0} />
              </div>
            )}
            <div className={styles.gPlot} style={{ height }} ref={laneIndex === 0 ? measureRef : undefined}>
              {grid}
              {placed.map(({ x, y, row }) => {
                const name = patientOf(row.movement).formalName;
                const label = `${name}, waited ${splitDuration(row.waited)}, ${causeTitle(row.cause)}`;
                return (
                  <button
                    key={row.movement.id}
                    type="button"
                    className={styles.gDot}
                    data-dim={anyFilter && !visible.has(row.movement.id) ? "true" : undefined}
                    aria-pressed={selectedId === row.movement.id}
                    aria-label={label}
                    style={{ left: `${(x / PLOT_WIDTH) * 100}%`, top: `calc(100% - ${13 + y * DOT + DOT / 2}px)` }}
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
                              {`Form ${row.movement.legalForm.code} ends ${formatInstantWithDay(now + row.dueIn, now)} as typed${standingSuffix(typedTimeStanding(row.movement, now, thresholds))}`}
                            </>
                          ) : null}
                        </>,
                      )
                    }
                    onMouseLeave={() => {
                      onTip(null);
                    }}
                  >
                    <StatusGlyph tone={rowTone(row, thresholds)} size={10} />
                  </button>
                );
              })}
              {overflow.map((pile) => (
                <span
                  key={pile.x}
                  className={polish.spreadMore}
                  style={{ left: `${(pile.x / PLOT_WIDTH) * 100}%`, bottom: `${13 + STACK * DOT}px` }}
                >
                  {`+${pile.n}`}
                </span>
              ))}
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
    <div className={`${styles.gMx} ${polish.mx}`}>
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
              const strength = n ? Math.round(8 + (n / max) * 40) : 0;
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
                  onClick={() => {
                    press(origin, column.id);
                  }}
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
                  onMouseLeave={() => {
                    onTip(null);
                  }}
                >
                  <span className={`${styles.mxN} ${styles.num} ${polish.mxN}`}>{n === 0 ? "–" : n}</span>
                  {over8 > 0 ? (
                    <span className={polish.mxO}>
                      <StatusGlyph tone="warning" size={9} />
                      <span className={styles.num}>{over8}</span>
                      {` over ${H8}`}
                    </span>
                  ) : null}
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
  const thresholds = useDueSoonThresholds();
  const { rows, shown, filters, onFilters, onClear, onToTable } = props;
  // Round 4 (Josh, 31 Oct 2026): the named next four hours open first; it is the one that says who
  // to ring. Where and whose move second, the whole spread last.
  const [graph, setGraph] = useState<Graph>("runway");
  const [lanes, setLanes] = useState<"owner" | "origin">("owner");
  const [cols, setCols] = useState<"owner" | "cause">("owner");
  const [tip, setTip] = useState<Tip>(null);
  const graphId = useId();
  const onTip = (event: React.MouseEvent | null, body?: ReactNode) => {
    if (event === null || body === undefined) {
      setTip(null);
      return;
    }
    setTip({ x: event.clientX, y: event.clientY, body });
  };
  const tabs: { id: Graph; label: string }[] = [
    { id: "runway", label: `Next ${hoursWord(RUNWAY_WINDOW)}` },
    { id: "matrix", label: "Where and whose move" },
    { id: "spread", label: "Wait spread" },
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
    window.requestAnimationFrame(() => document.getElementById(`${graphId}-tab-${tabs[next].id}`)?.focus());
  };

  const { urgentMinutes, soonMinutes } = thresholds;
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
          <StatusGlyph tone="warning" size={9} />
          {`Passes ${H8}`}
        </span>
        <span className={styles.lg}>
          <StatusGlyph tone="danger" size={9} />
          {`Passes ${H24}`}
        </span>
        <span className={styles.lg}>
          <StatusGlyph tone="info" size={9} />
          Recorded legal time, as typed
        </span>
        <span className={styles.lg}>Choose a person to open their row</span>
      </>
    ) : (
      <>
        <span className={styles.lg}>
          <i className={polish.mxKey} />
          Darker means more people waiting
        </span>
        <span className={styles.lg}>
          <StatusGlyph tone="warning" size={9} />
          {`Over ${H8} in that cell`}
        </span>
        <span className={styles.lg}>
          {WAIT_BANDS.map((band, index) => (
            <i key={band} className={styles[`band${index}`]} title={band} />
          ))}
          Wait bands, in the totals
        </span>
      </>
    );

  const sub =
    graph === "spread" ? (
      <>
        <span className={styles.eyebrow}>Rows</span>
        <div className={styles.seg} role="group" aria-label="Spread rows">
          <button
            type="button"
            aria-pressed={lanes === "owner"}
            onClick={() => {
              setLanes("owner");
            }}
          >
            Whose move
          </button>
          <button
            type="button"
            aria-pressed={lanes === "origin"}
            onClick={() => {
              setLanes("origin");
            }}
          >
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
        {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab, option or item */}
        <div className={`${styles.seg} ${styles.gTabs}`} role="tablist" aria-label="Delay graph" onKeyDown={onTabKey}>
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`${graphId}-tab-${entry.id}`}
              aria-controls={`${graphId}-panel`}
              aria-selected={graph === entry.id}
              tabIndex={graph === entry.id ? 0 : -1}
              onClick={() => {
                setGraph(entry.id);
              }}
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
        id={`${graphId}-panel`}
        role="tabpanel"
        aria-labelledby={`${graphId}-tab-${graph}`}
        className={styles.gScroll}
      >
        {graph === "spread" ? (
          <Spread {...props} lanes={lanes} onTip={onTip} />
        ) : graph === "runway" ? (
          <NextCrossings rows={props.rows} now={props.now} selectedId={props.selectedId} onPick={props.onPick} />
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
