"use client";

// Ward home's This shift and today's bed flow (Josh, 3 Nov 2026). WH2: This shift is one card whose
// summary opens the To do sheet, with a quiet link to Length of stay, which moved to Statistics.
// WH3: the day's discharges and booked arrivals sit beside it, counted from the same rows Ward flow
// lists. The band above already shows Ready now and Ready by shift end, so these do not repeat it.

import Link from "next/link";
import { CalendarClock, ChevronRight, ListChecks } from "lucide-react";
import { buttonClass } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import type { WardFlowTab } from "./ward-home-tab-model";
import { nameParts } from "./ward-bed-board-logic";
import {
  outlookHeadline,
  outlookOpenWork,
  outlookPlannedLaterNote,
  outlookSentence,
  type WardTomorrowOutlook,
} from "./ward-home-outlook";
import styles from "./ward-home-tab.module.css";

type WardHomeTodayStripProps = {
  hidden: boolean;
  unitId: string;
  now: Instant;
  todoOpen: number;
  actNow: number;
  checksDone: number;
  checksTotal: number;
  shiftSummary: string;
  /** The most urgent open task's title, or undefined when nothing is due. */
  nextTask: string | undefined;
  shiftSheetOpen: boolean;
  onOpenShift: () => void;
  dischargesToday: number;
  heldUp: number;
  confirmedToday: number;
  arrivals: number;
  backFromLeave: number;
  nextEta: Instant | undefined;
  /** WH3: this ward's own outlook for tomorrow, or null for a closed ward. */
  outlook: WardTomorrowOutlook | null;
  onOpenFlow: (tab: WardFlowTab) => void;
};

export function WardHomeTodayStrip({
  hidden,
  unitId,
  now,
  todoOpen,
  actNow,
  checksDone,
  checksTotal,
  shiftSummary,
  nextTask,
  shiftSheetOpen,
  onOpenShift,
  dischargesToday,
  heldUp,
  confirmedToday,
  arrivals,
  backFromLeave,
  nextEta,
  outlook,
  onOpenFlow,
}: WardHomeTodayStripProps) {
  return (
    <section
      hidden={hidden ? true : undefined}
      className={styles.todayStrip}
      id="ward-this-shift"
      aria-label="This shift and today's bed flow"
      data-testid="ward-today-strip"
    >
      <div className={styles.todayCard}>
        <span className={styles.todayCaps}>
          <ListChecks strokeWidth={1.75} size={14} aria-hidden="true" />
          This shift
        </span>
        <p className={styles.todayFigure}>
          <b>{todoOpen}</b> to do
          {actNow > 0 ? (
            <span className={styles.todayPill} data-tone="danger">
              {actNow} act now
            </span>
          ) : null}
        </p>
        {/* Every card answers "what next": the most urgent task, then the checks as context. */}
        <p className={styles.todayLine} data-testid="ward-shift-next">
          {nextTask === undefined ? "Nothing due now" : <>Next: {nextTask}</>}
        </p>
        <p className={styles.todayMeta}>
          {checksDone} of {checksTotal} checks done
        </p>
        <span className={styles.todayFoot}>
          <button
            type="button"
            className={buttonClass({ variant: "sec", size: "sm" })}
            aria-haspopup="dialog"
            aria-expanded={shiftSheetOpen}
            aria-label={`Open This shift, ${shiftSummary}`}
            data-testid="ward-shift-summary"
            onClick={onOpenShift}
          >
            Open to do
          </button>
          {/* Tablet and desktop only: this strip is not drawn on a phone, whose ward statistics page has
              no Length of stay card yet. "ward-stay" should switch to WARD_STAY_CARD_ID from
              statistics-sections.ts once that lands. */}
          <Link className={styles.quietLink} href={`${wardStatisticsHref(unitId)}#ward-stay`}>
            Length of stay
          </Link>
        </span>
      </div>
      <div className={styles.todayCard}>
        <span className={styles.todayCaps}>Discharges today</span>
        <p className={styles.todayFigure}>
          <b>{dischargesToday}</b> expected
          {heldUp > 0 ? (
            <span className={styles.todayPill} data-tone="danger">
              {heldUp} held up
            </span>
          ) : null}
        </p>
        <p className={styles.todayLine}>
          {dischargesToday === 0
            ? "Nothing to confirm"
            : `${Math.max(0, dischargesToday - confirmedToday)} to confirm, ${confirmedToday} confirmed`}
        </p>
        {dischargesToday + heldUp > 0 ? (
          <span className={styles.todayFoot}>
            <button
              type="button"
              className={buttonClass({ variant: "sec", size: "sm" })}
              onClick={() => onOpenFlow("discharges")}
            >
              Review discharges
            </button>
          </span>
        ) : null}
      </div>
      <div className={styles.todayCard}>
        <span className={styles.todayCaps}>Arrivals booked</span>
        <p className={styles.todayFigure}>
          <b>{arrivals}</b> coming in
          {backFromLeave > 0 ? (
            <span className={styles.todayPill} data-tone="neutral">
              {backFromLeave} back from leave
            </span>
          ) : null}
        </p>
        <p className={styles.todayLine}>
          {arrivals === 0
            ? "No one booked in"
            : nextEta === undefined
              ? "Arrival time not recorded"
              : `Next due ${formatInstantWithDay(nextEta, now)}`}
        </p>
        {arrivals + backFromLeave > 0 ? (
          <span className={styles.todayFoot}>
            <button
              type="button"
              className={buttonClass({ variant: "sec", size: "sm" })}
              onClick={() => onOpenFlow("admissions")}
            >
              Review arrivals
            </button>
          </span>
        ) : null}
      </div>
      {outlook ? <WardHomeTomorrowCard outlook={outlook} now={now} onOpenFlow={onOpenFlow} /> : null}
    </section>
  );
}

/** "2 short", "0 free" or "3 free": one end of the range, the zero said as the digit. */
function rangeEnd(value: number): string {
  return value < 0 ? `${-value} short` : `${value} free`;
}

/**
 * WH3 (Josh, 4 Nov 2026): Tomorrow, the Capacity forecast for this ward alone. One figure, the
 * frees against the people booked in, and the one action that firms the figure up. The hero and
 * the cards beside it already show today, so every figure here is tomorrow's.
 */
function WardHomeTomorrowCard({
  outlook,
  now,
  onOpenFlow,
}: {
  outlook: WardTomorrowOutlook;
  now: Instant;
  onOpenFlow: (tab: WardFlowTab) => void;
}) {
  const head = outlookHeadline(outlook.likely);
  const open = outlookOpenWork(outlook);
  const plannedLater = outlookPlannedLaterNote(outlook);
  return (
    <div className={styles.todayCard} data-testid="ward-tomorrow-card">
      <span className={styles.todayCaps}>
        Tomorrow
        <span className="sr-only">, by {formatInstantWithDay(outlook.until, now)}</span>
      </span>
      <p className={styles.todayFigure} data-tone={outlook.likely < 0 ? "short" : undefined}>
        {head.lead ? <span>{head.lead}</span> : null}
        <b>{head.figure}</b> {head.tail}
      </p>
      <p className={styles.todayLine}>
        {outlook.likelyOut} likely out, {outlook.bookedIn} booked in
      </p>
      <p className={styles.todayMeta} data-testid="ward-tomorrow-line">
        {open ?? `Could be ${rangeEnd(outlook.low)} to ${rangeEnd(outlook.high)}`}
      </p>
      {plannedLater ? (
        <p className={styles.todayMeta} data-testid="ward-tomorrow-planned-later">
          {plannedLater}
        </p>
      ) : null}
      <span className={styles.todayFoot}>
        {open !== null ? (
          <button
            type="button"
            className={buttonClass({ variant: "sec", size: "sm" })}
            aria-label={`Confirm dates. ${outlookSentence(outlook)}`}
            onClick={() => onOpenFlow("discharges")}
          >
            Confirm dates
          </button>
        ) : (
          <button type="button" className={styles.quietLink} onClick={() => onOpenFlow("discharges")}>
            Ward flow
          </button>
        )}
        <span className={styles.todayEstimate}>Estimate only</span>
      </span>
    </div>
  );
}

/**
 * WH5 (3 Nov 2026): a bed tile's words, as the bed board draws a bed. Surname, then the given name on
 * its own line, then one short state line ("210d", "On leave · 12d"). `name` is null for a free bed.
 */
export function WardHomeTileText({
  name,
  label,
  note,
  days,
}: {
  name: string | null;
  label: string;
  note: string;
  days: string;
}) {
  const parts = name === null ? null : nameParts(name);
  const stateLine = [note === BED_STATE_LABELS.occupied ? "" : note, days].filter(Boolean).join(" · ");
  return (
    <>
      <span className={styles.bedTileName} data-wrap={parts ? undefined : "true"} aria-hidden="true">
        {parts ? parts.last : label}
      </span>
      {parts ? (
        <span className={styles.bedTileGiven} aria-hidden="true">
          {parts.given}
        </span>
      ) : null}
      <span className={styles.bedTileState} aria-hidden="true">
        <span className={styles.bedTileNote}>{stateLine}</span>
      </span>
    </>
  );
}

/**
 * WH3 (Josh, 4 Nov 2026), phone: tomorrow for this ward as one row of My list, in one plain line. It
 * opens the ward's discharges, where the dates are confirmed.
 */
export function WardPhoneTomorrowRow({
  outlook,
  onTab,
  onSheet,
}: {
  outlook: WardTomorrowOutlook | null;
  onTab: (tab: WardFlowTab) => void;
  onSheet?: (panel: "flow") => void;
}) {
  if (outlook === null) return null;
  return (
    <button
      type="button"
      className={styles.needsRow}
      aria-haspopup="dialog"
      onClick={() => {
        onTab("discharges");
        onSheet?.("flow");
      }}
      data-testid="ward-phone-row-tomorrow"
    >
      <span className={styles.needsIcon} data-tone={outlook.likely < 0 ? "warning" : undefined} aria-hidden="true">
        <CalendarClock size={18} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className={styles.needsText}>
        <b>Tomorrow</b>
        <span>{outlookSentence(outlook)}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" className={styles.needsChevron} />
    </button>
  );
}
