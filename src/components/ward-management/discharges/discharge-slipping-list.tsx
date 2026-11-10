"use client";

import { useState } from "react";
import { Button, Card } from "@/components/wf";
import type { Unit } from "@/components/ward-management/ward-model";
import type { DischargeRecord } from "@/components/ward-management/ward-discharge-records";
import { slippingDischarges } from "@/components/ward-management/ward-discharge-date-trail";
import { EDD_SLIP_FLAG_DAYS } from "@/components/ward-management/ward-operational-defaults";
import { recordedDate, recordName, unitLabel } from "./discharge-board-model";
import styles from "./discharge-slipping-list.module.css";

const FIRST_ROWS = 5;

/**
 * Feature 6 (9 Nov 2026): stays whose expected discharge date now sits more than
 * `EDD_SLIP_FLAG_DAYS` after the first date the ward set, most slipped first. The ward's plan,
 * never a measure of the person. Shown only when there is at least one; a row opens its discharge.
 */
export function DischargeSlippingList({
  records,
  units,
  dayZero,
  onOpen,
}: {
  records: readonly DischargeRecord[];
  units: readonly Unit[];
  dayZero: Date;
  /** Opens the stay's discharge. Absent where this board cannot open one. */
  onOpen?: (admissionId: string, opener: HTMLElement) => void;
}) {
  const [all, setAll] = useState(false);
  const rows = slippingDischarges(
    records.map((record) => ({
      admissionId: record.admissionId,
      unitId: record.unitId,
      departed: record.admissionState === "departed",
      dischargeDateTrail: record.dischargeDateTrail,
      expectedDischargeAt: record.expectedDischargeAt,
    })),
    EDD_SLIP_FLAG_DAYS,
  );
  if (rows.length === 0) return null;
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);
  return (
    <Card
      as="section"
      className={styles.card}
      aria-labelledby="discharge-slipping-heading"
      data-testid="ward-discharge-slipping"
    >
      <header className={styles.head}>
        <h2 id="discharge-slipping-heading" className={styles.title}>
          Discharge dates slipping
        </h2>
        <p className={styles.summary}>
          {rows.length} {rows.length === 1 ? "stay" : "stays"} more than {EDD_SLIP_FLAG_DAYS} days later than first set.
          Most slipped first.
        </p>
      </header>
      <ul className={styles.list}>
        {shown.map((row) => {
          const record = records.find((candidate) => candidate.admissionId === row.admissionId);
          const ward = unitLabel(
            units.find((unit) => unit.id === row.unitId),
            row.unitId,
          );
          const content = (
            <>
              <span className={styles.main}>
                <span className={styles.name}>{record ? recordName(record) : "Name not recorded"}</span>
                <span className={styles.meta}>
                  {ward} · first {recordedDate(row.firstExpectedAt, dayZero)} · now{" "}
                  {recordedDate(row.expectedAt, dayZero)}
                </span>
              </span>
              <span className={styles.days}>
                +{row.slipDays}
                <span className="sr-only"> days slipped</span>
                <span aria-hidden="true">d</span>
              </span>
            </>
          );
          return (
            <li key={row.admissionId} data-testid={`ward-discharge-slipping-${row.admissionId}`}>
              {onOpen ? (
                <button
                  type="button"
                  className={styles.row}
                  onClick={(event) => onOpen(row.admissionId, event.currentTarget)}
                >
                  {content}
                </button>
              ) : (
                <div className={styles.row}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > FIRST_ROWS ? (
        <div className={styles.more}>
          <Button variant="ghost" size="sm" aria-expanded={all} onClick={() => setAll((open) => !open)}>
            {all ? "Show fewer" : `Show all ${rows.length}`}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
