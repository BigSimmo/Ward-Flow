"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { Button, StatusGlyph } from "@/components/wf";

import { unitHref } from "../shell/ward-facade";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import type { Unit } from "../ward-model";
import { UNCHANGED_SHIFTS_LISTED, shiftConfirmations, unchangedConfirmations } from "./shift-confirmations";
import styles from "./shift-confirmations.module.css";

/**
 * Smart features idea 6 (19 Oct 2026), the coordinator's half of "beds still correct": how many
 * wards have confirmed their numbers since this shift began, and which have not, so their figures
 * can be chased before the bed meeting. Under it, the wards
 * that have confirmed the same number unchanged for a day or more (`unchangedConfirmations`).
 */
export function ShiftConfirmationsCard({ units, now }: { units: readonly Unit[]; now: Instant }) {
  if (units.length === 0) return null;
  return <ShiftConfirmationsBody units={units} now={now} />;
}

function ShiftConfirmationsBody({ units, now }: { units: readonly Unit[]; now: Instant }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const summary = shiftConfirmations(units, now);
  const allDone = summary.waiting.length === 0;
  const unchanged = unchangedConfirmations(units);
  return (
    <section className={styles.section} aria-labelledby={`${listId}-title`} data-testid="shift-confirmations">
      <div className={styles.header}>
        <h3 id={`${listId}-title`} className={styles.title}>
          Confirmed this shift
        </h3>
        <span className={styles.figure} data-testid="shift-confirmations-figure">
          <StatusGlyph tone={allDone ? "success" : "warning"} size={8} /> {summary.confirmed} of {summary.total} wards
        </span>
      </div>
      <p className={styles.note}>
        {summary.shift} began {formatInstantWithDay(summary.since, now)}.
        {allDone ? " Every ward has confirmed its numbers since then." : null}
      </p>
      {allDone ? null : (
        <>
          <Button
            variant="light"
            size="sm"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
            data-testid="shift-confirmations-toggle"
          >
            {open ? "Hide" : "Show"} {summary.waiting.length} not confirmed
          </Button>
          {open ? (
            <ul id={listId} className={styles.list} data-testid="shift-confirmations-list">
              {summary.waiting.map((unit) => (
                <li key={unit.id} className={styles.item}>
                  <Link href={unitHref(unit.id)}>{unit.name}</Link>
                  <span className={styles.when}>
                    last confirmed {formatInstantWithDay(unit.allocatable.confirmedAt, now)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      {/* Idea 6's safety note: confirmed with no changes many shifts running. Listed by name only. */}
      {unchanged.length > 0 ? (
        <div className={styles.unchanged} data-testid="shift-confirmations-unchanged">
          <p className={styles.note}>
            Same number confirmed {UNCHANGED_SHIFTS_LISTED} or more shifts in a row, worth a look:
          </p>
          <ul className={styles.list}>
            {unchanged.map(({ unit, shifts }) => (
              <li key={unit.id} className={styles.item}>
                <Link href={unitHref(unit.id)}>{unit.name}</Link>
                <span className={styles.when}>{shifts} shifts</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
