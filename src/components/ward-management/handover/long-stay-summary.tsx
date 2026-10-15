"use client";

import { Badge } from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { longStaySummaries, strandedPromptText } from "@/components/ward-management/ward-stranded";

import styles from "./long-stay-summary.module.css";

/**
 * Long stay and delayed discharge summary (Top 25 item 20, flag `top25-long-stay-dossier`), on the
 * handover Beds tab. One row per person the stranded prompts would name (`ward-stranded.ts`): days
 * in bed, the recorded barrier and hold, and when the delayed discharge escalation point falls
 * against the ward's own expected discharge date. Read only. `admissions` is already scoped to the
 * wards in the handover's scope. Renders nothing when nobody is flagged.
 */
export function LongStaySummary({
  admissions,
  bedReleases,
  now,
  nameFor,
  wardFor,
}: {
  admissions: readonly Admission[];
  bedReleases: readonly BedRelease[];
  now: Instant;
  nameFor: (admission: Admission) => string;
  wardFor: (unitId: string) => string;
}) {
  const summaries = longStaySummaries(admissions, now, bedReleases);
  if (summaries.length === 0) return null;
  const byId = new Map(admissions.map((admission) => [admission.id, admission]));

  return (
    <section
      className={styles.panel}
      aria-labelledby="ward-long-stay-summary-heading"
      data-testid="ward-long-stay-summary"
    >
      <h3 id="ward-long-stay-summary-heading" className={styles.heading}>
        Long stays and delayed discharges ({summaries.length})
      </h3>
      <ul className={styles.list}>
        {summaries.map((summary) => {
          const admission = byId.get(summary.flag.admissionId);
          if (!admission) return null;
          const { flag } = summary;
          return (
            <li key={flag.admissionId} className={styles.row} data-testid={`ward-long-stay-${flag.admissionId}`}>
              <div className={styles.top}>
                <span className={styles.name}>{nameFor(admission)}</span>
                <span>{wardFor(admission.unitId)}</span>
                <Badge size="sm" tone="neutral">
                  {flag.days} day{flag.days === 1 ? "" : "s"} since admission
                </Badge>
                {summary.escalationReached ? (
                  <Badge size="sm" tone="warning">
                    Escalation point reached
                  </Badge>
                ) : null}
              </div>
              <p className={styles.detail}>{strandedPromptText(flag)}</p>
              <p className={styles.detail}>
                Barrier: {flag.barrier ?? "Not recorded"}. Hold: {summary.blockReason ?? "Not recorded"}.
              </p>
              <p className={styles.detail}>
                {summary.escalationAt === undefined
                  ? `Escalation point: ${summary.escalateAfterHours} hours after an expected discharge date, once one is recorded.`
                  : `Escalation point: ${formatInstantWithDay(summary.escalationAt, now)}, ${summary.escalateAfterHours} hours after the expected discharge date${summary.hoursPastExpected !== undefined ? `. ${summary.hoursPastExpected} hours past that date now.` : "."}`}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
