"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { StatusGlyph } from "@/components/wf";
import { LONG_WAIT_MINUTES, VERY_LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";

import { LONG_WAIT_HOURS, VERY_LONG_WAIT_HOURS, type EdWaitingEntry } from "./statistics-ed-waits";
import styles from "./statistics-ed-swarm.module.css";

/** The axis runs half as far again past the very long wait line; anyone past it sits on the last line. */
const AXIS_MAX_MINUTES = VERY_LONG_WAIT_MINUTES * 1.5;
const TICKS_HOURS = Array.from({ length: 7 }, (_, index) => (index * AXIS_MAX_MINUTES) / 60 / 6);
const RADIUS = 5;
/** Centre to centre, so two marks never touch (Josh, 9 Oct 2026: the old field was messy). */
const SPACING = RADIUS * 2 + 3;
const LANE = RADIUS * 2 + 2;
const MIN_ROW = 44;
/** A row never grows past seven lanes: a crowded row packs its lanes closer instead. */
const MAX_LANES = 7;
const ROW_PAD = 10;
const AXIS_H = 24;
const MIN_WIDTH = 280;

export type EdSwarmRow = {
  id: string;
  name: string;
  /** The ED's own statistics page. */
  href?: string;
  entries: readonly EdWaitingEntry[];
};

type Mark = { x: number; y: number; isolated: boolean; entry: EdWaitingEntry };

/**
 * A beeswarm: each person keeps their exact place on the time line and takes the offset nearest the
 * row's centre line where no other mark sits within SPACING, measured centre to centre in both
 * directions, so a crowd of near-equal waits packs into a tight honeycomb rather than one tall
 * column (H-0462). Longest wait first, so the marks that matter most hold the centre line.
 */
function pack(entries: readonly EdWaitingEntry[], toX: (minutes: number) => number): Mark[] {
  const marks: Mark[] = [];
  for (const entry of [...entries].sort((a, b) => b.waitMinutes - a.waitMinutes)) {
    const x = toX(entry.waitMinutes);
    const near = marks.filter((other) => Math.abs(other.x - x) < SPACING);
    // Touching each near mark from above or below, or on the centre line itself.
    const candidates = [0];
    for (const other of near) {
      const rise = Math.sqrt(SPACING * SPACING - (other.x - x) ** 2);
      candidates.push(other.y + rise, other.y - rise);
    }
    candidates.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
    const y =
      candidates.find((cy) => near.every((other) => Math.hypot(other.x - x, other.y - cy) >= SPACING - 0.01)) ?? 0;
    for (const other of near) other.isolated = false;
    marks.push({ x, y, isolated: near.length === 0, entry });
  }
  return marks;
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Shortens a name to its label column (about 7px a character at 13px), so it never runs into the marks. */
function fitName(name: string, width: number): string {
  const most = Math.max(4, Math.floor((width - 8) / 7));
  return name.length <= most ? name : `${name.slice(0, most - 1).trimEnd()}…`;
}

function hoursLabel(minutes: number): string {
  // Rounded first, so a median of 179.5 minutes reads 3h, never 2h 60m.
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Open ED journeys, one row per department and one mark per person along a 0 to 72 hour line,
 * with the 24 and 48 hour lines drawn. Shape carries the state: a filled dot has a ward, a ring has
 * none yet, an amber dot is past the long wait line and a triangle past the very long one. A row grows to fit its marks, so
 * they never overlap. Sized to its card, so the marks keep their size at every width.
 */
export function StatisticsEdSwarm({
  rows,
  labelWidth = 168,
  label = "Each open ED journey, by time since opening",
  testId = "ward-statistics-ed-swarm",
}: {
  rows: readonly EdSwarmRow[];
  labelWidth?: number;
  label?: string;
  testId?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  // Measured before paint, so the first frame on a phone is already its own width.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const first = Math.round(box.getBoundingClientRect().width);
    if (first > 0) setWidth(Math.max(MIN_WIDTH, first));
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(MIN_WIDTH, Math.round(entry.contentRect.width))),
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const compact = width < 560;
  const nameW = compact ? Math.min(labelWidth, 112) : labelWidth;
  const countW = 40;
  const plotLeft = nameW + RADIUS + 4;
  const plotW = Math.max(120, width - plotLeft - countW - RADIUS);
  const toX = (minutes: number) => plotLeft + (Math.min(minutes, AXIS_MAX_MINUTES) / AXIS_MAX_MINUTES) * plotW;

  const laid = useMemo(() => {
    const toX = (minutes: number) => plotLeft + (Math.min(minutes, AXIS_MAX_MINUTES) / AXIS_MAX_MINUTES) * plotW;
    const sized = rows.map((row) => {
      const marks = pack(row.entries, toX);
      const reach = marks.reduce((most, mark) => Math.max(most, Math.abs(mark.y)), 0);
      // A crowded row squeezes its offsets (and the crowded marks with them) to fit seven lanes.
      const most = ((MAX_LANES - 1) * LANE) / 2;
      const scale = reach > most ? most / reach : 1;
      const radius = scale < 1 ? Math.max(2, RADIUS * scale) : RADIUS;
      const span = Math.ceil(Math.min(reach, most) * 2 + LANE);
      return { row, marks, scale, radius, height: Math.max(MIN_ROW, span + ROW_PAD * 2) };
    });
    return sized.map((item, index) => {
      const top = sized.slice(0, index).reduce((sum, above) => sum + above.height, 0);
      return {
        ...item,
        top,
        mid: top + item.height / 2,
        median: median(item.row.entries.map((e) => e.waitMinutes)),
      };
    });
  }, [rows, plotLeft, plotW]);

  const plotH = laid.reduce((sum, item) => sum + item.height, 0);
  const totalH = plotH + AXIS_H;

  return (
    <div className={styles.swarm} data-testid={testId}>
      <div ref={boxRef} className={styles.box}>
        <svg width={width} height={totalH} viewBox={`0 0 ${width} ${totalH}`} role="img" aria-label={label}>
          {TICKS_HOURS.map((hours) => {
            const x = toX(hours * 60);
            const line = hours === LONG_WAIT_HOURS || hours === VERY_LONG_WAIT_HOURS;
            return (
              <g key={hours}>
                <line x1={x} x2={x} y1={0} y2={plotH} className={line ? styles.threshold : styles.grid} />
                <text x={x} y={plotH + 16} className={styles.axis} textAnchor="middle">
                  {hours * 60 === AXIS_MAX_MINUTES ? `${hours}h+` : `${hours}h`}
                </text>
              </g>
            );
          })}
          {laid.map(({ row, marks, scale, radius: crowded, top, mid, median: middle }, index) => (
            <g key={row.id}>
              {index > 0 ? <line x1={0} x2={width} y1={top} y2={top} className={styles.rowLine} /> : null}
              <text x={0} y={mid + 4} className={styles.name}>
                {fitName(row.name, nameW)}
                <title>{row.name}</title>
              </text>
              {middle !== undefined ? (
                <line x1={toX(middle)} x2={toX(middle)} y1={mid - 12} y2={mid + 12} className={styles.median} />
              ) : null}
              {marks.map(({ x, y, isolated, entry }) => {
                const cy = mid + y * scale;
                // A mark with no neighbour keeps its full size, so a lone long wait stays easy to see.
                const radius = isolated ? RADIUS : crowded;
                const over48 = entry.waitMinutes >= VERY_LONG_WAIT_MINUTES;
                const over24 = entry.waitMinutes >= LONG_WAIT_MINUTES;
                const placed = entry.movement.acceptedUnitId !== undefined;
                return over48 ? (
                  <path
                    key={entry.movement.id}
                    d={`M${x} ${cy - radius - 1} L${x + radius + 1} ${cy + radius} L${x - radius - 1} ${cy + radius} Z`}
                    className={styles.over48}
                  />
                ) : (
                  <circle
                    key={entry.movement.id}
                    cx={x}
                    cy={cy}
                    r={radius}
                    className={over24 ? styles.over24 : placed ? styles.placed : styles.unplaced}
                  />
                );
              })}
              <text x={width} y={mid + 4} className={styles.count} textAnchor="end">
                {row.entries.length}
              </text>
            </g>
          ))}
        </svg>
        {/* The figures as text, for a screen reader and for the links. */}
        <ul className={styles.rowLinks}>
          {laid.map(({ row, top, height, median: middle }) => {
            const noWard = row.entries.filter((e) => e.movement.acceptedUnitId === undefined).length;
            const past24 = row.entries.filter((e) => e.waitMinutes >= LONG_WAIT_MINUTES).length;
            const past48 = row.entries.filter((e) => e.waitMinutes >= VERY_LONG_WAIT_MINUTES).length;
            const summary = `${row.name}: ${row.entries.length} waiting${
              middle !== undefined ? `, median ${hoursLabel(middle)}` : ""
            }, ${noWard} with no ward yet, ${past24} past ${LONG_WAIT_HOURS} hours, ${past48} past ${VERY_LONG_WAIT_HOURS} hours`;
            return (
              <li key={row.id} style={{ top, height }}>
                {row.href ? (
                  <Link href={row.href} className={styles.rowLink} aria-label={`${summary}. Open ${row.name}`} />
                ) : (
                  <span className={styles.srOnly}>{summary}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <p className={styles.legend}>
        <span>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <circle cx="5" cy="5" r="4" className={styles.placed} />
          </svg>
          Ward accepted
        </span>
        <span>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <circle cx="5" cy="5" r="3.4" className={styles.unplaced} />
          </svg>
          No ward yet
        </span>
        <span>
          <StatusGlyph tone="warning" size={10} />
          Past {LONG_WAIT_HOURS}h
        </span>
        <span>
          <StatusGlyph tone="danger" size={10} />
          Past {VERY_LONG_WAIT_HOURS}h
        </span>
        <span className={styles.medianKey}>Median line</span>
      </p>
    </div>
  );
}
