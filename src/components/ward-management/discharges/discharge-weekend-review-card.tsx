"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  formatInstant,
  formatInstantWithDay,
  perthDateLabel,
  perthDayLabel,
  type Instant,
} from "@/components/ward-management/ward-clock";
import type { DischargeRecord, WardRecordActor } from "@/components/ward-management/ward-discharge-records";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { Button, Card, CardHead, ShowMoreRow, foldHidden, foldLimit, requestConfirm } from "@/components/wf";
import { recordName } from "./discharge-board-model";
import { upcomingWeekendWindow, weekendReviewRows } from "./discharge-weekend-review";
import styles from "./discharge-weekend-review.module.css";

/** Audit three #25: the sub line names only an exception; nothing open says nothing. */
function arrangementsText(outstanding: number | null): string | null {
  if (outstanding === null) return "Arrangements not recorded";
  if (outstanding === 0) return null;
  return `${outstanding} open ${outstanding === 1 ? "arrangement" : "arrangements"}`;
}

/**
 * The weekend's span and review count, for a card head that holds this list and the closed
 * services together (Thread C mock-up, Thu and Fri).
 */
export function weekendReviewSummary(
  records: readonly DischargeRecord[],
  releases: readonly BedRelease[],
  now: Instant,
  dayZero: Date,
): { span: string; reviewed: number; total: number } {
  const window = upcomingWeekendWindow(now, dayZero);
  const rows = weekendReviewRows(records, releases, window);
  const first = perthDateLabel(window.start, dayZero, { weekday: "short", day: "numeric" });
  const last = perthDateLabel(window.end - 1, dayZero, { weekday: "short", day: "numeric", month: "short" });
  return {
    span: `${first} to ${last}`,
    reviewed: rows.filter((row) => row.reviewed !== null).length,
    total: rows.length,
  };
}

/** Rows before "Show all": the design system's eight. */
const ROWS_SHOWN = 8;

/**
 * Feature 14 (Josh, 9 Nov 2026): Weekend discharges. Every inpatient whose ward has recorded an
 * expected discharge on the coming weekend (Saturday to Monday, widened over a joined WA public
 * holiday), with the ward, the expected time, the open arrangements and a Reviewed tick per person.
 * The tick records the time and desk, and belongs to this weekend only. It reads expected dates
 * already recorded and says nothing about who could go.
 */
export function DischargeWeekendReview({
  records,
  releases,
  units,
  now,
  dayZero,
  actorFor,
  dispatch,
  embedded = false,
}: {
  records: readonly DischargeRecord[];
  releases: readonly BedRelease[];
  units: readonly Unit[];
  now: Instant;
  dayZero: Date;
  /** The desk this session acts as for a stay on that ward. */
  actorFor: (unitId: string) => WardRecordActor;
  dispatch: WardCommandDispatch;
  /** Inside the combined Weekend discharges card: no card or head of its own, and nothing when empty. */
  embedded?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const window = upcomingWeekendWindow(now, dayZero);
  const rows = weekendReviewRows(records, releases, window);
  const reviewed = rows.filter((row) => row.reviewed !== null).length;
  const first = perthDateLabel(window.start, dayZero, { weekday: "short", day: "numeric" });
  const last = perthDateLabel(window.end - 1, dayZero, { weekday: "short", day: "numeric", month: "short" });
  const span = `${first} to ${last}`;
  const hidden = foldHidden(rows.length, ROWS_SHOWN);
  const listed = showAll ? rows : rows.slice(0, foldLimit(rows.length, ROWS_SHOWN));
  const canTickFor = (unitId: string) => {
    const actor = actorFor(unitId);
    return actor.role === "coordinator" || (actor.role === "ward" && actor.actingUnitId === unitId);
  };
  const markReviewed = (stay: (typeof rows)[number]["stay"]) => {
    const actor = actorFor(stay.unitId);
    wardRaise(
      dispatch,
      actor.role,
      now,
    )("MARK_WEEKEND_DISCHARGE_REVIEWED", {
      admissionId: stay.admissionId,
      weekendStart: window.start,
      ...(actor.role === "ward" ? { actingUnitId: actor.actingUnitId } : {}),
    });
  };
  /* Audit three #72 (Josh, 28 Nov 2026: offer it for weekend discharges with nothing open only).
     One tick for the rows with no open arrangement this desk can mark; any row with something open
     keeps its own check. No Undo yet: the engine has no undo for this tick. */
  const clearRows = rows.filter((row) => row.reviewed === null && row.outstanding === 0 && canTickFor(row.stay.unitId));
  const list = (
    <>
      {clearRows.length >= 2 ? (
        <div className={styles.bulk} data-testid="ward-discharge-weekend-review-bulk">
          <span className={styles.meta}>{clearRows.length} with nothing open</span>
          <Button
            size="sm"
            variant="sec"
            onClick={() => {
              // Audit four 16: the tick cannot be undone yet, so ask first, naming the count (D-93 is the model).
              const count = clearRows.length;
              void requestConfirm({
                title: `Mark ${count} reviewed?`,
                message: `This ticks ${count} weekend discharges with nothing open as reviewed. It cannot be undone yet.`,
                confirmLabel: `Mark all ${count} reviewed`,
                cancelLabel: "Not now",
                confirmTone: "default",
              }).then((confirmed) => {
                if (confirmed) clearRows.forEach((row) => markReviewed(row.stay));
              });
            }}
          >
            Mark all {clearRows.length} reviewed
          </Button>
        </div>
      ) : null}
      <ul className={styles.rows} id="discharge-weekend-review-rows">
        {listed.map(({ stay, expectedAt, outstanding, reviewed: tick }) => {
          const ward = units.find((unit) => unit.id === stay.unitId)?.name ?? "Ward not recorded";
          const canTick = canTickFor(stay.unitId);
          const name = recordName(stay);
          return (
            <li key={stay.admissionId} className={styles.row} data-testid="ward-discharge-weekend-review-row">
              <span className={styles.main}>
                <span className={styles.name}>{name}</span>
                <span className={styles.meta}>
                  {ward}
                  {arrangementsText(outstanding) ? ` · ${arrangementsText(outstanding)}` : null}
                </span>
              </span>
              <span className={styles.when}>
                {perthDayLabel(expectedAt, dayZero)} {formatInstant(expectedAt)}
              </span>
              <span className={styles.action}>
                {tick ? (
                  <span className={styles.done}>
                    <Check size={14} aria-hidden="true" />
                    Reviewed <span className={styles.figure}>{formatInstantWithDay(tick.at, now)}</span>
                    <span className="sr-only"> by {WARD_FLOW_ROLE_LABELS[tick.by]}</span>
                  </span>
                ) : canTick ? (
                  <Button size="sm" aria-label={`Mark reviewed: ${name}`} onClick={() => markReviewed(stay)}>
                    Mark reviewed
                  </Button>
                ) : (
                  <span className={styles.pending}>Not reviewed</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {hidden > 0 ? (
        <ShowMoreRow
          onClick={() => setShowAll((open) => !open)}
          expanded={showAll}
          controls="discharge-weekend-review-rows"
        >
          {showAll ? "Show fewer" : `Show all ${rows.length}`}
        </ShowMoreRow>
      ) : null}
    </>
  );
  if (embedded) {
    if (rows.length === 0) return null;
    return (
      <section
        className={styles.section}
        aria-labelledby="discharge-weekend-review-heading"
        data-testid="ward-discharge-weekend-review"
      >
        <h3 id="discharge-weekend-review-heading" className={styles.sectionHead}>
          To review
        </h3>
        {list}
      </section>
    );
  }
  return (
    <Card
      as="section"
      className={styles.card}
      aria-labelledby="discharge-weekend-review-heading"
      data-testid="ward-discharge-weekend-review"
    >
      <CardHead
        title={<span id="discharge-weekend-review-heading">Weekend discharges</span>}
        meta={rows.length > 0 ? `${span} · ${reviewed} of ${rows.length} reviewed` : span}
      />
      {rows.length === 0 ? <p className={styles.empty}>No expected discharges recorded for {span}.</p> : list}
    </Card>
  );
}
