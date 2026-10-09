"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";

import { minutesText } from "./alerts-model";
import styles from "./alerts.module.css";

/**
 * Alerts visuals (9 Oct 2026, round 2 option A). Every point is a time the record holds: raised,
 * declined, accepted, acted on, sent. Nothing is projected. Status colour only, direct labels, at
 * most four faint gridlines, one dashed now line (v3 chart rules).
 */

/** The rendered width of a chart's frame, so labels keep their real size at every width. */
function useFrameWidth(fallback: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const measured = Math.round(entries[0]?.contentRect.width ?? 0);
      if (measured > 0) setWidth(measured);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export type MarkShape = "act" | "wait" | "done" | "closed";

const SHAPES: Record<MarkShape, ReactNode> = {
  act: <path d="M0 -6 6 5H-6Z" className={styles.mAct} />,
  wait: <circle r="4.6" className={styles.mWait} />,
  done: <path d="M-5 0-2.6-2.4 0 .2 4.4-4.4 6.4-2.4 0 4Z" className={styles.mDone} />,
  closed: (
    <path d="M-4.5-3 -3-4.5 0-1.5 3-4.5 4.5-3 1.5 0 4.5 3 3 4.5 0 1.5-3 4.5-4.5 3-1.5 0Z" className={styles.mClosed} />
  ),
};

function Mark({
  shape,
  x,
  y,
  title,
  selected,
  onPick,
}: {
  shape: MarkShape;
  x: number;
  y: number;
  title: string;
  selected?: boolean;
  onPick?: () => void;
}) {
  if (!onPick) {
    return (
      <g transform={`translate(${x.toFixed(1)} ${y})`}>
        <title>{title}</title>
        {SHAPES[shape]}
      </g>
    );
  }
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onPick();
  };
  return (
    <g
      transform={`translate(${x.toFixed(1)} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={title}
      aria-pressed={selected}
      className={styles.markHit}
      onClick={onPick}
      onKeyDown={onKeyDown}
    >
      <title>{title}</title>
      <circle r="11" className={selected ? styles.markRingOn : styles.markRing} />
      {SHAPES[shape]}
    </g>
  );
}

/** A time axis from `from` to `to` minutes over `width` px: hour gridlines, at most four. */
function timeAxis(from: Instant, to: Instant, width: number, height: number, padLeft: number, now: Instant) {
  const x = (minute: Instant) => padLeft + ((width - padLeft - 8) * (minute - from)) / Math.max(1, to - from);
  let hours: number[] = [];
  for (let minute = Math.ceil(from / 60) * 60; minute <= to; minute += 60) hours.push(minute);
  while (hours.length > 4) hours = hours.filter((_, index) => index % 2 === 0);
  const nearNow = (minute: number) => Math.abs(x(minute) - x(now)) < 44;
  const grid = hours.map((minute) => (
    <g key={minute}>
      <line x1={x(minute)} x2={x(minute)} y1={4} y2={height - 18} className={styles.gridLine} />
      {nearNow(minute) ? null : (
        <text x={x(minute)} y={height - 4} className={styles.axisText} textAnchor="middle">
          {formatInstantWithDay(minute, now)}
        </text>
      )}
    </g>
  ));
  const nowLine = (
    <g>
      <line x1={x(now)} x2={x(now)} y1={2} y2={height - 18} className={styles.nowLine} />
      <text x={x(now)} y={height - 4} className={styles.axisNow} textAnchor="middle">
        {formatInstantWithDay(now, now)}
      </text>
    </g>
  );
  return { x, grid, nowLine };
}

export type TodayPoint = { id: string; at: Instant; shape: MarkShape; title: string };
export type TodaySpan = { id: string; from: Instant; until: Instant; title: string };

/**
 * Today: what was raised, acted on and broadcast. Raised marks open the alert; a broadcast is a
 * solid bar to now and a dashed bar for the time it has left.
 */
export function TodayChart({
  raised,
  acted,
  broadcasts,
  now,
  selectedId,
  onPick,
}: {
  raised: TodayPoint[];
  acted: TodayPoint[];
  broadcasts: TodaySpan[];
  now: Instant;
  selectedId?: string;
  onPick: (id: string) => void;
}) {
  const [frameRef, width] = useFrameWidth(960);
  const height = 150;
  const earliest = Math.min(now - 120, ...raised.map((point) => point.at), ...broadcasts.map((span) => span.from));
  const from = Math.max(now - 360, Math.floor((earliest - 20) / 60) * 60);
  const to = now + 45;
  const { x, grid, nowLine } = timeAxis(from, to, width, height, 82, now);
  const clamp = (minute: Instant) => Math.min(to, Math.max(from, minute));
  const rows: [string, number][] = [
    ["Raised", 30],
    ["Acted on", 78],
    ["Broadcast", 112],
  ];
  // Stacked lanes so raised marks close in time never sit on each other.
  const lanes = [30, 16, 44, 2, 58];
  const lastX: number[] = [];
  const raisedMarks = [...raised]
    .sort((a, b) => a.at - b.at)
    .map((point) => {
      const px = x(clamp(point.at));
      let lane = 0;
      while (lastX[lane] !== undefined && px - lastX[lane]! < 15 && lane < lanes.length - 1) lane += 1;
      lastX[lane] = px;
      return { ...point, px, y: lanes[lane]! };
    });
  return (
    <div ref={frameRef} className={styles.chartFrame}>
      <svg
        className={styles.chart}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={`Today: ${raised.length} open alerts raised, ${acted.length} actions recorded, ${broadcasts.length} broadcasts`}
      >
        {grid}
        {rows.map(([label, y]) => (
          <g key={label}>
            <text x={0} y={y + 4} className={styles.rowLabel}>
              {label}
            </text>
            <line x1={82} x2={width - 8} y1={y} y2={y} className={styles.rowLine} />
          </g>
        ))}
        {broadcasts.map((span) => {
          const start = x(clamp(span.from));
          const solidEnd = x(clamp(Math.min(now, span.until)));
          return (
            <g key={span.id}>
              <rect
                x={start}
                y={107}
                width={Math.max(4, solidEnd - start)}
                height={10}
                rx={5}
                className={styles.spanOn}
              >
                <title>{span.title}</title>
              </rect>
              {span.until > now ? (
                <rect
                  x={x(now)}
                  y={107}
                  width={Math.max(0, x(clamp(span.until)) - x(now))}
                  height={10}
                  rx={5}
                  className={styles.spanLeft}
                >
                  <title>Ends {formatInstantWithDay(span.until, now)}</title>
                </rect>
              ) : null}
            </g>
          );
        })}
        {acted.map((point) => (
          <Mark key={point.id} shape={point.shape} x={x(clamp(point.at))} y={78} title={point.title} />
        ))}
        {raisedMarks.map((point) => (
          <Mark
            key={point.id}
            shape={point.shape}
            x={point.px}
            y={point.y}
            title={point.title}
            selected={point.id === selectedId}
            onPick={() => onPick(point.id)}
          />
        ))}
        {nowLine}
      </svg>
    </div>
  );
}

export type LadderStep = { id: string; at: Instant; short: string; title: string };

/** Each ward's decline on one time line, short names alternating above and below. */
export function DeclineLadder({ steps, now }: { steps: LadderStep[]; now: Instant }) {
  const [frameRef, width] = useFrameWidth(366);
  const height = 86;
  const sorted = [...steps].sort((a, b) => a.at - b.at);
  const first = sorted[0]?.at ?? now - 60;
  const last = sorted.at(-1)?.at ?? now;
  const from = Math.floor((first - 15) / 30) * 30;
  const { x, grid, nowLine } = timeAxis(from, now + 15, width, height, 8, now);
  return (
    <div ref={frameRef} className={styles.chartFrame}>
      <svg
        className={styles.chart}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${sorted.length} declines between ${formatInstantWithDay(first, now)} and ${formatInstantWithDay(last, now)}`}
      >
        {grid}
        <line x1={8} x2={width - 8} y1={36} y2={36} className={styles.rowLine} />
        {sorted.map((step, index) => (
          <g key={step.id}>
            <Mark shape="closed" x={x(step.at)} y={36} title={step.title} />
            <text x={x(step.at)} y={index % 2 ? 58 : 22} className={styles.pointLabel} textAnchor="middle">
              {step.short}
            </text>
          </g>
        ))}
        {nowLine}
      </svg>
    </div>
  );
}

export type TrackPoint = { at: Instant; label: string; shape: MarkShape };

/** One line from the first recorded time to now, with what happened on it. */
export function WaitTrack({ points, now }: { points: TrackPoint[]; now: Instant }) {
  const [frameRef, width] = useFrameWidth(366);
  const height = 64;
  const sorted = [...points].sort((a, b) => a.at - b.at);
  const start = sorted[0]?.at ?? now;
  const from = Math.floor((Math.min(start, now) - 10) / 30) * 30;
  const { x, grid, nowLine } = timeAxis(from, Math.max(now, sorted.at(-1)?.at ?? now) + 15, width, height, 8, now);
  return (
    <div ref={frameRef} className={styles.chartFrame}>
      <svg
        className={styles.chart}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={sorted.map((point) => `${point.label} ${formatInstantWithDay(point.at, now)}`).join(", ")}
      >
        {grid}
        <line x1={x(start)} x2={x(now)} y1={24} y2={24} className={styles.spanLine} />
        {sorted.map((point) => (
          <g key={`${point.label}-${point.at}`}>
            <Mark
              shape={point.shape}
              x={x(point.at)}
              y={24}
              title={`${point.label}, ${formatInstantWithDay(point.at, now)}`}
            />
            <text
              x={Math.min(width - 60, Math.max(36, x(point.at)))}
              y={10}
              className={styles.pointLabel}
              textAnchor="middle"
            >
              {point.label}
            </text>
          </g>
        ))}
        {nowLine}
      </svg>
    </div>
  );
}

/** Time left on a broadcast: the used part of its life drawn as a ring, time left in the centre. */
export function TimeRing({
  from,
  until,
  now,
  size = 64,
  onHero = false,
}: {
  from: Instant;
  until: Instant;
  now: Instant;
  size?: number;
  onHero?: boolean;
}) {
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const left = Math.max(0, until - now);
  const fraction = Math.max(0, Math.min(1, left / Math.max(1, until - from)));
  const centre = size / 2;
  return (
    <svg
      className={onHero ? styles.ringOnHero : styles.ring}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${minutesText(left)} left`}
    >
      <circle cx={centre} cy={centre} r={radius} className={styles.ringTrack} />
      <circle
        cx={centre}
        cy={centre}
        r={radius}
        className={styles.ringFill}
        strokeDasharray={`${(circumference * fraction).toFixed(1)} ${circumference.toFixed(1)}`}
        transform={`rotate(-90 ${centre} ${centre})`}
      />
      {size >= 48 ? (
        <text x="50%" y={centre + 1} className={styles.ringText} textAnchor="middle" dominantBaseline="middle">
          {minutesText(left).replace(" ", "")}
        </text>
      ) : null}
    </svg>
  );
}
