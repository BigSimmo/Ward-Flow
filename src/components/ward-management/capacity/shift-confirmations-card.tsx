"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { Button, StatusGlyph } from "@/components/wf";

import { unitHref } from "../shell/ward-facade";
import { useWardFeatureFlag } from "../shell/ward-feature-flag-store";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import type { Unit } from "../ward-model";
import { shiftConfirmations } from "./shift-confirmations";
import styles from "./shift-confirmations.module.css";

/**
 * Smart features idea 6 (19 Oct 2026), the coordinator's half of "beds still correct": how many
 * wards have confirmed their numbers since this shift began, and which have not, so their figures
 * can be chased before the bed meeting. Behind the `shift-confirmations` switch.
 */
export function ShiftConfirmationsCard({ units, now }: { units: readonly Unit[]; now: Instant }) {
  const enabled = useWardFeatureFlag("shift-confirmations");
  if (!enabled || units.length === 0) return null;
  return <ShiftConfirmationsBody units={units} now={now} />;
}

function ShiftConfirmationsBody({ units, now }: { units: readonly Unit[]; now: Instant }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const summary = shiftConfirmations(units, now);
  const allDone = summary.waiting.length === 0;
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
    </section>
  );
}
