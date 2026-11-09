"use client";

/*
 * "Where the hours went" (item 8): the journey's elapsed time split into named waits, beside the
 * timeline on the patient page. Every figure comes from `hoursBreakdown`, which reads only recorded
 * times; a stage with a missing boundary says "Not recorded". The bar is a share of the total,
 * not a clock: no target, no countdown, nothing coloured for good or bad.
 */

import { StackBar, tableClasses, type StackSegment, type WfFill } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  hoursBreakdown,
  hoursText,
  type HoursStage,
  type HoursStageKey,
} from "@/components/ward-management/ward-hours-breakdown";
import styles from "./patient-hours-breakdown.module.css";

/** One fill per stage, told apart by shade and order; none of them is a status colour. */
const STAGE_FILL: Record<HoursStageKey, WfFill> = {
  review: "data-1",
  form: "data-2",
  bed: "data-3",
  transport: "neutral",
};

function stageValue(stage: HoursStage): string {
  if (stage.minutes !== undefined) return hoursText(stage.minutes);
  if (stage.status === "not_needed") return "Not needed";
  if (stage.status === "out_of_order") return "Out of order";
  return "Not recorded";
}

export function PatientHoursBreakdown({ movement, now }: { movement: Movement; now: Instant }) {
  const breakdown = hoursBreakdown(movement, now);
  const segments: StackSegment[] = [
    ...breakdown.stages
      .filter((stage) => stage.minutes !== undefined && stage.minutes > 0)
      .map((stage) => ({
        id: stage.key,
        value: stage.minutes ?? 0,
        fill: STAGE_FILL[stage.key],
        hatch: stage.status === "running",
        label: `${stage.label} ${hoursText(stage.minutes ?? 0)}`,
      })),
    ...(breakdown.otherMinutes
      ? [
          {
            id: "other",
            value: breakdown.otherMinutes,
            fill: "track" as const,
            label: `Not in a named stage ${hoursText(breakdown.otherMinutes)}`,
          },
        ]
      : []),
  ];
  return (
    <section className={styles.hours} aria-labelledby="pn-hours-head" data-testid="pn-hours-breakdown">
      <div className={styles.head}>
        <h2 id="pn-hours-head" className={styles.title}>
          Where the hours went
        </h2>
        <span className={styles.meta}>
          <span className={styles.mono}>{hoursText(breakdown.totalMinutes)}</span>{" "}
          {breakdown.open ? "since opened, so far" : "from opened to departure"}
        </span>
      </div>
      {segments.length > 0 ? <StackBar segments={segments} label="Where the hours went" /> : null}
      <table className={`${tableClasses.table} ${styles.table}`}>
        <thead>
          <tr>
            <th scope="col" className={tableClasses.th}>
              Stage
            </th>
            <th scope="col" className={`${tableClasses.th} ${styles.numHead}`}>
              Hours
            </th>
          </tr>
        </thead>
        <tbody>
          {breakdown.stages.map((stage) => (
            <tr key={stage.key} data-status={stage.status}>
              <th scope="row" className={styles.stage}>
                <span className={styles.stageInner}>
                  <span
                    className={styles.swatch}
                    data-fill={stage.minutes !== undefined ? STAGE_FILL[stage.key] : "none"}
                    data-hatch={stage.status === "running" || undefined}
                    aria-hidden="true"
                  />
                  <span className={styles.stageText}>
                    <span>{stage.label}</span>
                    <span className={styles.span}>
                      {stage.span}
                      {stage.status === "running" ? ", running now" : stage.note ? ` · ${stage.note}` : ""}
                    </span>
                  </span>
                </span>
              </th>
              <td className={stage.minutes === undefined ? styles.missing : styles.num}>{stageValue(stage)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row" className={styles.stage}>
              <span className={styles.stageInner}>
                <span
                  className={styles.swatch}
                  data-fill={breakdown.otherMinutes ? "track" : "none"}
                  aria-hidden="true"
                />
                <span className={styles.stageText}>
                  <span>Not in a named stage</span>
                  <span className={styles.span}>
                    {breakdown.overlap
                      ? "Stages overlap, so they do not add up"
                      : "Gaps between stages and unrecorded parts"}
                  </span>
                </span>
              </span>
            </th>
            <td className={breakdown.otherMinutes === undefined ? styles.missing : styles.num}>
              {breakdown.otherMinutes === undefined ? "Not worked out" : hoursText(breakdown.otherMinutes)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className={styles.foot}>From recorded times only. Nothing is estimated.</p>
    </section>
  );
}
