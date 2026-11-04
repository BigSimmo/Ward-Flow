"use client";

// Ward home's This shift and today's bed flow (Josh, 3 Nov 2026). WH2: This shift is one card whose
// summary opens the To do sheet, with a quiet link to Length of stay, which moved to Statistics.
// WH3: the day's discharges and booked arrivals sit beside it, counted from the same rows Ward flow
// lists. The band above already shows Ready now and Ready by shift end, so these do not repeat it.

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { buttonClass } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import type { WardFlowTab } from "./ward-home-tab-model";
import { nameParts } from "./ward-bed-board";
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
          <ListChecks size={14} aria-hidden="true" />
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
    </section>
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
