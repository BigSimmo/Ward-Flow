"use client";

// Alerts redesign (Josh, approved 1 Nov 2026; spec design/alerts-redesign-2026-11): the Today
// timeline sits in the header band, with the at-a-glance line under it. It replaces the separate
// Today card and the band's broadcast button. Six hours, the future hatched, a now line and one mark
// per alert; marks stack in rows of 22px so none overlap.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Radio } from "lucide-react";

import { StatusGlyph, type WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";

import { minutesText } from "./alerts-model";
import type { TodayPoint, TodaySpan } from "./alerts-visuals";
import styles from "./alerts-today-band.module.css";

const SPAN = 6 * 60;
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
export function markGapMinutes(trackWidth: number): number {
  if (!(trackWidth > 0)) return MIN_GAP;
  return Math.max(MIN_GAP, Math.ceil((MARK_PITCH / trackWidth) * SPAN));
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
  checking,
  liveBroadcast,
  onOpenBroadcast,
}: {
  raised: TodayPoint[];
  acted: TodayPoint[];
  broadcasts: TodaySpan[];
  now: Instant;
  selectedId?: string;
  onPick: (id: string) => void;
  /** Alerts with no raised time: counted in the glance line, never drawn. */
  noTimeCount: number;
  /** The Checking chip and its pop-over. */
  checking?: ReactNode;
  liveBroadcast?: { until: Instant };
  onOpenBroadcast: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  // Josh review (4 Nov 2026): the dots stay in the band as a shorter strip, open by default. The
  // glance line can still fold it away.
  const [open, setOpen] = useState(true);
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    setTrackWidth(track.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setTrackWidth(track.clientWidth));
    observer.observe(track);
    return () => observer.disconnect();
  }, [open]);
  // 07:00 to 13:00 at 10:42: three whole hours before now's hour, three after.
  const from = Math.floor(now / 60) * 60 - 3 * 60;
  const to = from + SPAN;
  const pct = (at: Instant) => `${(((Math.min(to, Math.max(from, at)) - from) / SPAN) * 100).toFixed(2)}%`;
  const hours = Array.from({ length: 7 }, (_, index) => from + index * 60);
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
    markGapMinutes(trackWidth),
  );
  const extraRows = Math.max(0, ...marks.map((mark) => mark.row + 1)) - ROWS;
  const anyBroadcast = broadcasts.length > 0;
  const toggle = (
    <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen((was) => !was)}>
      <ChevronDown size={14} aria-hidden="true" className={styles.toggleIcon} />
      Today <b>{raised.length}</b> raised
    </button>
  );
  return (
    <section className={styles.band} aria-label="Today" data-open={open ? "true" : undefined}>
      {open ? (
        <>
          <div className={styles.head}>
            <span>Today</span>
            <span className={styles.headNote}>one mark per alert</span>
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
        </>
      ) : null}
      <div className={styles.glance}>
        {toggle}
        {checking ? <span className={styles.glanceChecking}>{checking}</span> : null}
        <span>
          Acted on today <b>{acted.length}</b>
        </span>
        {liveBroadcast ? (
          <button type="button" onClick={onOpenBroadcast}>
            <span className={styles.livePulse} aria-hidden="true" /> Broadcast live{" "}
            <b>{minutesText(Math.max(0, liveBroadcast.until - now))}</b> left
          </button>
        ) : (
          <span>No broadcast live</span>
        )}
        {noTimeCount > 0 ? <span>{noTimeCount} with no time, not shown</span> : null}
      </div>
    </section>
  );
}
