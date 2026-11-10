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
import { Button, Card, CardHead, ShowMoreRow, foldHidden, foldLimit } from "@/components/wf";
import { recordName } from "./discharge-board-model";
import { upcomingWeekendWindow, weekendReviewRows } from "./discharge-weekend-review";
import styles from "./discharge-weekend-review.module.css";

function arrangementsText(outstanding: number | null): string {
  if (outstanding === null) return "Arrangements not recorded";
  if (outstanding === 0) return "No open arrangements";
  return `${outstanding} open ${outstanding === 1 ? "arrangement" : "arrangements"}`;
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
}: {
  records: readonly DischargeRecord[];
  releases: readonly BedRelease[];
  units: readonly Unit[];
  now: Instant;
  dayZero: Date;
  /** The desk this session acts as for a stay on that ward. */
  actorFor: (unitId: string) => WardRecordActor;
  dispatch: WardCommandDispatch;
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
      {rows.length === 0 ? (
        <p className={styles.empty}>No expected discharges recorded for {span}.</p>
      ) : (
        <>
          <ul className={styles.rows} id="discharge-weekend-review-rows">
            {listed.map(({ stay, expectedAt, outstanding, reviewed: tick }) => {
              const ward = units.find((unit) => unit.id === stay.unitId)?.name ?? "Ward not recorded";
              const actor = actorFor(stay.unitId);
              const canTick =
                actor.role === "coordinator" || (actor.role === "ward" && actor.actingUnitId === stay.unitId);
              const name = recordName(stay);
              return (
                <li key={stay.admissionId} className={styles.row} data-testid="ward-discharge-weekend-review-row">
                  <span className={styles.main}>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.meta}>
                      {ward} · {arrangementsText(outstanding)}
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
                      <Button
                        size="sm"
                        aria-label={`Mark ${name} reviewed`}
                        onClick={() =>
                          wardRaise(
                            dispatch,
                            actor.role,
                            now,
                          )("MARK_WEEKEND_DISCHARGE_REVIEWED", {
                            admissionId: stay.admissionId,
                            weekendStart: window.start,
                            ...(actor.role === "ward" ? { actingUnitId: actor.actingUnitId } : {}),
                          })
                        }
                      >
                        Reviewed
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
      )}
    </Card>
  );
}
