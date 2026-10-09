"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { StatusGlyph } from "@/components/wf";
import { LONG_WAIT_MINUTES, VERY_LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";

import type { EdWaitingEntry } from "./statistics-ed-waits";
import styles from "./statistics-ed-swarm.module.css";

/** The axis runs to 72 hours; anyone past it sits on the 72h+ line. */
const AXIS_MAX_MINUTES = 72 * 60;
const TICKS_HOURS = [0, 12, 24, 36, 48, 60, 72] as const;
const RADIUS = 5;
/** Centre to centre, so two marks never touch (Josh, 9 Oct 2026: the old field was messy). */
const SPACING = RADIUS * 2 + 3;
const LANE = RADIUS * 2 + 2;
const MIN_ROW = 44;
const ROW_PAD = 10;
const AXIS_H = 24;

export type EdSwarmRow = {
  id: string;
  name: string;
  /** The ED's own statistics page. */
  href?: string;
  entries: readonly EdWaitingEntry[];
};

type Mark = { x: number; lane: number; entry: EdWaitingEntry };

/**
 * Packs each person into the lane nearest the row's centre line where no other mark sits within
 * SPACING: 0, then 1 above, 1 below, 2 above and so on. Longest wait first, so the marks that matter
 * most hold the centre line.
 */
function pack(entries: readonly EdWaitingEntry[], toX: (minutes: number) => number): Mark[] {
  const lanes = new Map<number, number[]>();
  const marks: Mark[] = [];
  for (const entry of [...entries].sort((a, b) => b.waitMinutes - a.waitMinutes)) {
    const x = toX(entry.waitMinutes);
    for (let step = 0; ; step += 1) {
      const lane = step === 0 ? 0 : step % 2 === 1 ? -Math.ceil(step / 2) : Math.ceil(step / 2);
      const taken = lanes.get(lane) ?? [];
      if (taken.every((other) => Math.abs(other - x) >= SPACING)) {
        taken.push(x);
        lanes.set(lane, taken);
        marks.push({ x, lane, entry });
        break;
      }
    }
  }
  return marks;
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function hoursLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Everyone waiting in ED, one row per department and one mark per person along a 0 to 72 hour line,
 * with the 24 and 48 hour lines drawn. Shape carries the state: a filled dot has a ward, a ring has
 * none yet, an amber dot is past 24 hours and a triangle past 48. A row grows to fit its marks, so
 * they never overlap. Sized to its card, so the marks keep their size at every width.
 */
export function StatisticsEdSwarm({
  rows,
  labelWidth = 168,
  label = "Each person waiting in ED, by how long they have waited",
  testId = "ward-statistics-ed-swarm",
}: {
  rows: readonly EdSwarmRow[];
  labelWidth?: number;
  label?: string;
  testId?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.round(entry.contentRect.width))));
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
      const reach = marks.reduce((most, mark) => Math.max(most, Math.abs(mark.lane)), 0);
      return { row, marks, height: Math.max(MIN_ROW, (reach * 2 + 1) * LANE + ROW_PAD * 2) };
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
            const line = hours === 24 || hours === 48;
            return (
              <g key={hours}>
                <line x1={x} x2={x} y1={0} y2={plotH} className={line ? styles.threshold : styles.grid} />
                <text x={x} y={plotH + 16} className={styles.axis} textAnchor="middle">
                  {hours === 72 ? "72h+" : `${hours}h`}
                </text>
              </g>
            );
          })}
          {laid.map(({ row, marks, top, mid, median: middle }, index) => (
            <g key={row.id}>
              {index > 0 ? <line x1={0} x2={width} y1={top} y2={top} className={styles.rowLine} /> : null}
              <text x={0} y={mid + 4} className={styles.name}>
                {row.name}
              </text>
              {middle !== undefined ? (
                <line x1={toX(middle)} x2={toX(middle)} y1={mid - 12} y2={mid + 12} className={styles.median} />
              ) : null}
              {marks.map(({ x, lane, entry }) => {
                const cy = mid + lane * LANE;
                const over48 = entry.waitMinutes >= VERY_LONG_WAIT_MINUTES;
                const over24 = entry.waitMinutes >= LONG_WAIT_MINUTES;
                const placed = entry.movement.acceptedUnitId !== undefined;
                return over48 ? (
                  <path
                    key={entry.movement.id}
                    d={`M${x} ${cy - RADIUS - 1} L${x + RADIUS + 1} ${cy + RADIUS} L${x - RADIUS - 1} ${cy + RADIUS} Z`}
                    className={styles.over48}
                  />
                ) : (
                  <circle
                    key={entry.movement.id}
                    cx={x}
                    cy={cy}
                    r={RADIUS}
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
            const summary = `${row.name}: ${row.entries.length} waiting${
              middle !== undefined ? `, median ${hoursLabel(middle)}` : ""
            }, ${row.entries.filter((e) => e.waitMinutes >= LONG_WAIT_MINUTES).length} past 24 hours`;
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
      <p className={styles.legend} aria-hidden="true">
        <span>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <circle cx="5" cy="5" r="4" className={styles.placed} />
          </svg>
          Ward accepted
        </span>
        <span>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <circle cx="5" cy="5" r="3.4" className={styles.unplaced} />
          </svg>
          No ward yet
        </span>
        <span>
          <StatusGlyph tone="warning" size={10} />
          Past 24h
        </span>
        <span>
          <StatusGlyph tone="danger" size={10} />
          Past 48h
        </span>
        <span className={styles.medianKey}>Median</span>
      </p>
    </div>
  );
}
