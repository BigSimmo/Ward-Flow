"use client";

import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { StatusGlyph, durMinutes } from "@/components/wf";

import { rowTone, type HandoverColumn, type HandoverColumnId } from "./handover-columns";
import { STAGE_LABEL, dueParts, nextStep } from "./handover-model";
import styles from "./handover-refined.module.css";

/**
 * Handover redesign (Josh, 1 Nov 2026): the on-screen columns. Status and Next step merge into one
 * "Next step" column (the action, then the stage and owner), and what is due rides under the wait,
 * so the eye reads one time column, not two. The print sheet keeps every chosen column as it was.
 */
export function screenColumnsFor(columns: HandoverColumn[], columnIds: readonly HandoverColumnId[]): HandoverColumn[] {
  if (!(columnIds.includes("st") && columnIds.includes("next"))) return columns;
  const merged: HandoverColumn[] = [
    ...columns.filter((column) => column.id === "pt"),
    {
      id: "next",
      header: "Next step",
      width: 280,
      cell: (row, cellCtx) => {
        const step = nextStep(row, cellCtx.now, cellCtx.cutoff, cellCtx.readyBeds);
        return (
          <span className={styles.two}>
            <span className={styles.stepLine} title={step.text}>
              <StatusGlyph tone={rowTone(row, cellCtx)} size={9} />
              <span className={styles.trunc}>{step.text}</span>
            </span>
            <span className={`${styles.sub} ${styles.trunc}`} title={`${STAGE_LABEL[row.stage]} · ${row.ownerShort}`}>
              {STAGE_LABEL[row.stage]} · <SpelledCodes text={row.ownerShort} />
            </span>
          </span>
        );
      },
      paper: () => "",
    },
    ...columns.filter((column) => column.id !== "pt" && column.id !== "st" && column.id !== "next"),
  ];
  // Round 5: what is due rides under the wait, so the eye reads one time column, not two. Only
  // when both are chosen: with Waiting hidden, Due keeps its own column; with Due hidden, no due line.
  const dueUnderWait = columnIds.includes("wait") && columnIds.includes("due");
  return merged
    .filter((column) => !(dueUnderWait && column.id === "due"))
    .map((column) =>
      column.id === "wait"
        ? {
            ...column,
            header: "Waiting",
            width: 150,
            cell: (row, cellCtx) => {
              const due = dueUnderWait ? dueParts(row, cellCtx.now) : null;
              return (
                <span className={styles.two}>
                  <b className={styles.mono}>{durMinutes(cellCtx.now - row.openedAt)}</b>
                  {due ? (
                    <span className={`${styles.sub} ${styles.dueSub}`} title={`${due.what} ${due.when}`}>
                      <StatusGlyph tone="warning" size={8} />
                      <span className={styles.trunc}>
                        {due.what} <b className={styles.mono}>{due.when}</b>
                      </span>
                    </span>
                  ) : (
                    <span className={`${styles.sub} ${styles.mono} ${styles.trunc}`}>
                      since {formatInstantWithDay(row.openedAt, cellCtx.now)}
                    </span>
                  )}
                </span>
              );
            },
          }
        : column.id === "route"
          ? { ...column, header: "From → to" }
          : column,
    );
}
