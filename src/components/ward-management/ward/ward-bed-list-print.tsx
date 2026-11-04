"use client";

import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { formatSheetMoment, type Instant, isClockBreached } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import { observationSummary } from "@/components/ward-management/ward-observation";

import type { WardScreenBed } from "./ward-screen-derivations";
import styles from "./ward-bed-list-print.module.css";

/**
 * THE PRINTED BED LIST (Tier 1 item 9, Josh 4 Nov 2026: "Yes to all recommendations").
 *
 * The downtime fallback for one ward: every bed on one page, with who is in it, its state, the
 * legal status and the form's end time as typed, observations and the expected date out. If the
 * app is down, the last printout keeps the ward running.
 *
 * Paper only. It is hidden on screen, where the Every bed card already says all of this. On paper
 * the card's tiles collapse at page width, so before this the ward page printed with no beds at
 * all. It reads the same `bedsList` the Every bed card draws, so the two cannot disagree.
 *
 * Legal times are only as typed (Josh, 31 Oct 2026): "Ends 15:42 as typed", never a running
 * figure. Names are shown in full (D-83). Synthetic data only.
 */
export function WardBedListPrint({
  unit,
  beds,
  now,
  dayZero,
}: {
  unit: Unit;
  beds: readonly WardScreenBed[];
  now: Instant;
  /** Anchors every time on the sheet to a calendar date: a printout outlives the day it was taken. */
  dayZero: Date;
}) {
  if (beds.length === 0) return null;
  return (
    <section
      className={styles.sheet}
      aria-label={`${unit.name} bed list for printing`}
      data-testid="ward-bed-list-print"
    >
      <div className={styles.head}>
        <h2 className={styles.title}>{unit.name} bed list</h2>
        <p className={styles.meta}>
          As at {formatSheetMoment(now, dayZero, { includeYearAndZone: true })}. {beds.length} beds. Legal times are as
          typed from the form, not legally checked. Synthetic data.
        </p>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Bed</th>
            <th scope="col">Patient</th>
            <th scope="col">State</th>
            <th scope="col">Days</th>
            <th scope="col">Legal status</th>
            <th scope="col">Form end</th>
            <th scope="col">Observations</th>
            <th scope="col">Expected out</th>
          </tr>
        </thead>
        <tbody>
          {beds.map((bed) => (
            <tr key={String(bed.bedNumber)} data-testid={`ward-bed-list-print-${bed.bedNumber}`}>
              <th scope="row">{String(bed.bedNumber).padStart(2, "0")}</th>
              <td>
                {bedPerson(bed)}
                {bed.umrn && bedHasPerson(bed) ? <span className={styles.sub}>{bed.umrn}</span> : null}
              </td>
              <td>
                {bedState(bed)}
                {bedNote(bed) ? <span className={styles.sub}>{bedNote(bed)}</span> : null}
              </td>
              <td className={styles.num}>{typeof bed.stayDays === "number" ? bed.stayDays : ""}</td>
              <td>{bedHasPerson(bed) ? (bed.legalStatusLabel ?? "Not recorded") : ""}</td>
              <td>{formEnd(bed, now, dayZero)}</td>
              <td>{bed.observation && bedHasPerson(bed) ? observationSummary(bed.observation) : ""}</td>
              <td>{bedHasPerson(bed) && bed.status !== "incoming" ? expectedOut(bed, dayZero) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** A bed with a person on it: in the bed, on leave or pulled for someone on their way. */
function bedHasPerson(bed: WardScreenBed): boolean {
  return bed.status === "occupied" || bed.status === "leave" || bed.status === "incoming";
}

function bedPerson(bed: WardScreenBed): string {
  if (bedHasPerson(bed)) return bed.patientAlias ?? "Name not recorded";
  // A free bed held for an accepted referral names who it is held for.
  return bed.heldFor ? `Held for ${bed.heldFor}` : "";
}

/** The same state words as the Every bed card. */
function bedState(bed: WardScreenBed): string {
  if (bed.status === "ready") return bed.preparing ? BED_STATE_LABELS.beingMadeReady : "Ready";
  if (bed.status === "leave") return bed.statusText === "Absent without leave" ? "Absent without leave" : "On leave";
  if (bed.status === "incoming") return typeof bed.deliveredAt === "number" ? "Arrived at ward" : "Pulled";
  if (bed.status === "closed") return "Closed";
  return "Occupied";
}

/** The one thing to look at for this bed, in words. */
function bedNote(bed: WardScreenBed): string | undefined {
  if (bed.status === "incoming") return bed.bedHold?.label;
  if (bed.awayAtEdHours != null) return `Away at an ED ${bed.awayAtEdHours}h`;
  if (bed.blockReason) return `Held up, ${String(bed.blockReason)}`;
  if (bed.dischargeBarrier) return String(bed.dischargeBarrier);
  if (bed.pastDate) return "Past expected date";
  if (bed.dischargeConfirmed === true) return "Discharge confirmed";
  return undefined;
}

/** The expected discharge as a dated time, never "tomorrow": the paper copy may be read days later. */
function expectedOut(bed: WardScreenBed, dayZero: Date): string {
  if (typeof bed.expectedDischargeAt === "number") return formatSheetMoment(bed.expectedDischargeAt, dayZero);
  return bed.expectedDischargeLabel ?? "Not recorded";
}

/** The current form's end time as typed. A form the stay has moved on from shows nothing here. */
function formEnd(bed: WardScreenBed, now: Instant, dayZero: Date): string {
  const form = bed.legalForm as { code?: string; dueAt?: Instant; endedBy?: unknown } | undefined;
  if (!bedHasPerson(bed) || !form?.code || typeof form.dueAt !== "number") return "";
  // An explicitly ended form keeps its due time as history, not a current end.
  if (form.endedBy !== undefined) return "";
  // The label names the form to record next when this one has ended, so its old time is history.
  if (!bed.legalStatusLabel?.startsWith(`Form ${form.code}`)) return "";
  // A dated time, never "tomorrow": the paper copy may be read days later.
  return `${isClockBreached(form.dueAt, now) ? "Ended" : "Ends"} ${formatSheetMoment(form.dueAt, dayZero)} as typed`;
}
