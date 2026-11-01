"use client";

// src/components/ward-management/reports/waiting-stages-card.tsx
//
// Statistics' "Where waiting time builds up" (closing-the-loop features, Josh, 24 Oct 2026). Each
// placement stage's typical time across the journeys on record, from recorded times only, with the
// journeys missing a time counted as "not recorded". Every count opens the journeys behind it, each
// linking to its record. A report view: stages stay in journey order and the ED queue is untouched.
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Hourglass } from "lucide-react";

import { CardBody, tableClasses } from "@/components/wf";
import { StatCard } from "@/components/ward-management/statistics/statistics-hero";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { MINIMUM_EFFECTIVENESS_SAMPLE } from "@/components/ward-management/ward-derivations-records";
import type { Movement } from "@/components/ward-management/ward-model";
import { originName } from "@/components/ward-management/ward-movement-origin";

import { waitingStages, type WaitingStageId, type WaitingStageJourney } from "./waiting-stages";
import styles from "./closing-loop.module.css";

type Group = "recorded" | "notRecorded" | "inStageNow";

const GROUP_WORDS: Record<Group, string> = {
  recorded: "with both times recorded",
  notRecorded: "not recorded",
  inStageNow: "in this stage now",
};

/** No name, UMRN or journey number on Statistics (D-39): the admission number, else where and when. */
function journeyName(movement: Movement, admissions: readonly Admission[], now: Instant): string {
  const admission = admissions.find((each) => each.movementId === movement.id)?.id ?? movement.admissionId;
  return (
    admission ??
    `${originName(movement) ?? "Origin not recorded"}, raised ${formatInstantWithDay(movement.openedAt, now)}`
  );
}

export function WaitingStagesCard({
  movements,
  admissions,
  now,
}: {
  movements: readonly Movement[];
  admissions: readonly Admission[];
  now: Instant;
}) {
  const rows = useMemo(() => waitingStages(movements), [movements]);
  const [open, setOpen] = useState<{ stage: WaitingStageId; group: Group } | null>(null);
  const listId = useId();
  const openRow = open ? rows.find((row) => row.id === open.stage) : undefined;
  const openJourneys: WaitingStageJourney[] = openRow && open ? openRow[open.group] : [];

  const countButton = (stage: WaitingStageId, group: Group, count: number) => {
    const pressed = open?.stage === stage && open.group === group;
    return (
      <button
        type="button"
        className={styles.countButton}
        aria-expanded={pressed}
        aria-controls={listId}
        disabled={count === 0}
        onClick={() => setOpen(pressed ? null : { stage, group })}
        data-testid={`ward-waiting-stage-${stage}-${group}`}
      >
        {count}
      </button>
    );
  };

  return (
    <StatCard
      id="waiting-stages"
      icon={Hourglass}
      title="Where waiting time builds up"
      meta="All journeys on record"
      data-testid="ward-statistics-waiting-stages"
    >
      <CardBody>
        <div className={styles.tableWrap}>
          <table className={`${tableClasses.table} ${styles.table}`}>
            <caption className={styles.srOnly}>Time spent in each placement stage, synthetic</caption>
            <thead>
              <tr>
                <th scope="col">Stage</th>
                <th scope="col" className={styles.num}>
                  Typical
                </th>
                <th scope="col" className={styles.num}>
                  Slowest 1 in 10
                </th>
                <th scope="col" className={styles.num}>
                  Recorded
                </th>
                <th scope="col" className={styles.num}>
                  Not recorded
                </th>
                <th scope="col" className={styles.num}>
                  In stage now
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    {row.label}
                    <span className={styles.sub}>{row.span}</span>
                  </th>
                  <td className={styles.num}>
                    {row.summary.median === undefined ? "—" : splitDuration(row.summary.median)}
                  </td>
                  <td className={styles.num}>{row.summary.p90 === undefined ? "—" : splitDuration(row.summary.p90)}</td>
                  <td className={styles.num}>{countButton(row.id, "recorded", row.recorded.length)}</td>
                  <td className={styles.num}>{countButton(row.id, "notRecorded", row.notRecorded.length)}</td>
                  <td className={styles.num}>{countButton(row.id, "inStageNow", row.inStageNow.length)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.caption}>
          Recorded times only. A typical time needs {MINIMUM_EFFECTIVENESS_SAMPLE} journeys with both times.
        </p>
        <div id={listId}>
          {openRow && open ? (
            <>
              <h3 className={styles.listHead}>
                {openRow.label}: {openJourneys.length} {openJourneys.length === 1 ? "journey" : "journeys"}{" "}
                {GROUP_WORDS[open.group]}
              </h3>
              <ul className={styles.list} data-testid="ward-waiting-stage-journeys">
                {openJourneys.map(({ movement, minutes }) => (
                  <li key={movement.id}>
                    <Link href={movementHref(movement.id)}>{journeyName(movement, admissions, now)}</Link>
                    <span className={styles.sub}>
                      {minutes !== undefined
                        ? splitDuration(minutes)
                        : open.group === "notRecorded"
                          ? "Not recorded"
                          : "Still in this stage"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </CardBody>
    </StatCard>
  );
}
