"use client";

// Alerts redesign (Josh, approved 1 Nov 2026; spec design/alerts-redesign-2026-11): the Today
// timeline sits in the header band. Page tops (Josh, 9 Nov 2026): it is slimmer, always open, and
// the at-a-glance line under it became the shared Today band (`HeroBand`, alerts-hero.tsx). The
// window starts an hour before the first alert's hour (at most three whole hours before now's hour)
// and ends so now sits near 80% across, so the marks spread. The future is hatched, a now line and
// one mark per alert; marks stack in rows so none overlap.

import { useLayoutEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";

import { StatusGlyph, type WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";

import type { TodayPoint, TodaySpan } from "./alerts-visuals";
import styles from "./alerts-today-band.module.css";

/** The widest window: three whole hours before now's hour to three after (07:00 to 13:00 at 10:42). */
const SPAN = 6 * 60;
/** Now sits about this far across the window. */
const NOW_AT = 0.8;
/** 24px marks with a 2px gap, so each mark meets the 24px target size and spacing (WCAG 2.5.8). */
const ROW_HEIGHT = 26;
/** The track's resting height: two rows above a 5px foot (Josh, 4 Nov 2026: shorter). Matches `.track` in the CSS. */
const TRACK_HEIGHT = 58;
const ROWS = 2;
/** Marks closer than this many minutes go on the next row. */
const MIN_GAP = 10;
/** A mark's 24px plus the 2px gap: the least distance between two marks on one row (WCAG 2.5.8). */
const MARK_PITCH = 26;

/**
 * A8 (accessibility check, 2 Nov 2026): the minutes two marks on one row must be apart so they do not
 * overlap on a track this many pixels wide. At 820 wide ten minutes is about 14px, so marks overlapped.
 */
export function markGapMinutes(trackWidth: number, span: number = SPAN): number {
  if (!(trackWidth > 0)) return MIN_GAP;
  return Math.max(MIN_GAP, Math.ceil((MARK_PITCH / trackWidth) * span));
}

/**
 * Page tops (Josh, 9 Nov 2026): the window the track draws. It starts an hour before the first
 * mark's hour, but never more than three whole hours before now's hour (an earlier mark is drawn at
 * the left edge), and ends on a half hour so now sits near 80% across: 08:00 to 11:30 at 10:42 when
 * the first alert came at 09:35. With no mark it shows the two hours before now's hour.
 */
function todayWindow(now: Instant, markTimes: readonly Instant[]): { from: number; to: number } {
  const hour = Math.floor(now / 60) * 60;
  const first = markTimes.length > 0 ? Math.min(...markTimes) : undefined;
  const from = Math.min(
    hour,
    Math.max(hour - 3 * 60, first === undefined ? hour - 2 * 60 : Math.floor(first / 60) * 60 - 60),
  );
  const span = Math.max(60, Math.ceil((now - from) / NOW_AT / 30) * 30);
  return { from, to: from + Math.min(SPAN, span) };
}
/** Hour labels this close to now are hidden so the now label stays readable. */
const NEAR_NOW = 25;

const TONE: Record<TodayPoint["shape"], WfTone> = {
  act: "danger",
  wait: "warning",
  done: "success",
  closed: "neutral",
};

type BandMark = { id: string; at: Instant; tone: WfTone; title: string; pick: boolean; broadcast?: boolean };

/**
 * Rows for each mark, by where it is drawn, so marks close together stack instead of overlapping.
 * A mark before or after the six hours is drawn at that edge, so it is stacked there too.
 */
function stackRows(marks: BandMark[], from: number, to: number, minGap: number): (BandMark & { row: number })[] {
  const drawnAt = (mark: BandMark) => Math.min(to, Math.max(from, mark.at));
  const lastIn = Array.from({ length: ROWS }, () => -Infinity);
  return [...marks]
    .sort((a, b) => drawnAt(a) - drawnAt(b))
    .map((mark) => {
      let row = lastIn.findIndex((at) => drawnAt(mark) - at >= minGap);
      // Every row is taken near this minute: open another row rather than draw over a mark.
      if (row < 0) row = lastIn.push(-Infinity) - 1;
      lastIn[row] = drawnAt(mark);
      return { ...mark, row };
    });
}

export function TodayBand({
  raised,
  acted,
  broadcasts,
  now,
  selectedId,
  onPick,
  noTimeCount,
}: {
  raised: TodayPoint[];
  acted: TodayPoint[];
  broadcasts: TodaySpan[];
  now: Instant;
  selectedId?: string;
  onPick: (id: string) => void;
  /** Alerts with no raised time: counted in the head, never drawn. */
  noTimeCount: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    setTrackWidth(track.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setTrackWidth(track.clientWidth));
    observer.observe(track);
    return () => observer.disconnect();
  }, []);
  const { from, to } = todayWindow(now, [
    ...raised.map((point) => point.at),
    ...acted.map((point) => point.at),
    ...broadcasts.map((span) => span.from),
  ]);
  const span = to - from;
  const pct = (at: Instant) => `${(((Math.min(to, Math.max(from, at)) - from) / span) * 100).toFixed(2)}%`;
  // Whole hours inside the window, and its end when that is a half hour (11:30).
  const hours = Array.from({ length: Math.floor(span / 60) + 1 }, (_, index) => from + index * 60);
  if (hours.at(-1) !== to) hours.push(to);
  const marks = stackRows(
    [
      ...raised.map((point) => ({
        id: point.id,
        at: point.at,
        tone: TONE[point.shape],
        title: point.title,
        pick: true,
      })),
      ...acted.map((point) => ({
        id: point.id,
        at: point.at,
        tone: TONE[point.shape],
        title: point.title,
        pick: false,
      })),
      ...broadcasts.map((span) => ({
        id: span.id,
        at: span.from,
        tone: "info" as const,
        title: span.title,
        pick: false,
        broadcast: true,
      })),
    ],
    from,
    to,
    markGapMinutes(trackWidth, span),
  );
  const extraRows = Math.max(0, ...marks.map((mark) => mark.row + 1)) - ROWS;
  const anyBroadcast = broadcasts.length > 0;
  return (
    <section className={styles.band} aria-label="Today">
      <div className={styles.head}>
        <span>Today</span>
        <span className={styles.headNote}>
          one mark per alert{noTimeCount > 0 ? ` · ${noTimeCount} with no time, not shown` : ""}
        </span>
        <span className={styles.legend}>
          <span>
            <StatusGlyph tone="danger" size={9} /> Act now raised
          </span>
          <span>
            <StatusGlyph tone="warning" size={9} /> Waiting raised
          </span>
          <span>
            <StatusGlyph tone="success" size={9} /> Acted on
          </span>
          {anyBroadcast ? (
            <span>
              <Radio size={12} aria-hidden="true" /> Broadcast
            </span>
          ) : null}
        </span>
      </div>
      <div
        ref={trackRef}
        className={styles.track}
        role="group"
        aria-label="Alerts raised and acted on today"
        style={extraRows > 0 ? { height: `${TRACK_HEIGHT + extraRows * ROW_HEIGHT}px` } : undefined}
      >
        <span className={styles.future} style={{ left: pct(now) }} />
        {hours.slice(1, -1).map((hour) => (
          <span key={hour} className={styles.hour} style={{ left: pct(hour) }} />
        ))}
        <span className={styles.nowLine} style={{ left: pct(now) }} />
        {marks.map((mark) => {
          const style = { left: pct(mark.at), bottom: `${5 + mark.row * ROW_HEIGHT}px` };
          const inner = mark.broadcast ? (
            <Radio size={12} aria-hidden="true" />
          ) : (
            <StatusGlyph tone={mark.tone} size={9} />
          );
          return mark.pick ? (
            <button
              key={`${mark.id}-${mark.at}`}
              type="button"
              className={styles.mark}
              data-tone={mark.tone}
              style={style}
              aria-label={mark.title}
              title={mark.title}
              aria-pressed={selectedId === mark.id}
              onClick={() => onPick(mark.id)}
            >
              {inner}
            </button>
          ) : (
            <span
              key={`${mark.id}-${mark.at}`}
              className={styles.mark}
              data-tone={mark.tone}
              data-static="true"
              style={style}
              role="img"
              aria-label={mark.title}
              title={mark.title}
            >
              {inner}
            </span>
          );
        })}
      </div>
      <div className={styles.axis} aria-hidden="true">
        {hours
          .filter((hour) => Math.abs(hour - now) > NEAR_NOW)
          .map((hour) => (
            <span
              key={hour}
              style={{ left: pct(hour) }}
              data-edge={hour === from ? "start" : hour === to ? "end" : undefined}
            >
              {formatInstantWithDay(hour, now)}
            </span>
          ))}
        <span className={styles.axisNow} style={{ left: pct(now) }}>
          {formatInstantWithDay(now, now)}
        </span>
      </div>
    </section>
  );
}
