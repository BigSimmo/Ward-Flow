"use client";

/**
 * Triage and risk on the patient record (built 7 Nov 2026): the person's signed triages, newest
 * first, as their codes in words, and the Triage action that opens a new, blank triage for them.
 * Shown on the record's Now tab for a desk that may triage or when a triage is on record. A signed
 * triage keeps codes only, so this never shows typed text. Synthetic data only.
 */
import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { Icon, buttonClass } from "@/components/wf";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { calendarDateOf, perthCalendarDay, perthClockTime } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { WARD_TRIAGE_NEW_HREF } from "@/components/ward-management/ward-nav";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";

import { triageHrefFor } from "./triage-href";
import { LEGAL, REVIEW, TIER_LONG, triagesFor, type TriageSignedRecord } from "./triage-record";
import styles from "./patient-triage-card.module.css";

/** The signed-in synthetic clinician who signs, as the form names them (`SIGNED_IN`). */
const REVIEWER = "Dr S. Chen";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const LEGAL_NAME: Readonly<Record<string, string>> = Object.fromEntries(LEGAL);
const REVIEW_NAME: Readonly<Record<string, string>> = Object.fromEntries(REVIEW);

function signedLine(record: TriageSignedRecord, dayZero: Date): string {
  const moment = calendarDateOf(record.at, dayZero);
  const day = perthCalendarDay(moment);
  return `Signed ${String(day.day).padStart(2, "0")} ${MONTHS[day.monthIndex]} ${perthClockTime(moment)} by ${REVIEWER}`;
}

/** One signed triage in words: urgency, outcome, legal status as chosen, the review and the flag count. */
export function triageRecordWords(record: TriageSignedRecord): string[] {
  const flags = record.riskFlags.length;
  return [
    `Urgency ${record.urgency}, ${TIER_LONG[record.urgency].toLowerCase()}`,
    record.outcome,
    `${LEGAL_NAME[record.legal] ?? "Legal status not recorded"} (as chosen). Not legally checked.`,
    `Review risk by ${(REVIEW_NAME[record.review] ?? "not set").toLowerCase()}`,
    flags ? `${flags} risk ${flags === 1 ? "flag" : "flags"} present` : "No risk flags marked present",
  ];
}

export function PatientTriageCard({ patientId }: { patientId: string | undefined }) {
  const { triages, dayZero } = useWardFlowSelect("triages", "dayZero");
  const canOpen = useCanOpenHref();
  const gate = useRoleGate({ patientId })("RECORD_TRIAGE_SIGNED");
  if (!patientId) return null;
  const signed = triagesFor(triages, patientId);
  const canTriage = gate.allowed && canOpen(WARD_TRIAGE_NEW_HREF);
  if (!canTriage && signed.length === 0) return null;
  const latest = signed[0];
  const meta = signed.length ? `${signed.length} signed` : "SMHMR900 and SMHMR905";
  // Version 2 (12 Nov 2026): a row of the Now page's small card, in the status rows' own form: a
  // tinted icon, the title over what is on record, and the one action on the right edge.
  return (
    <section
      className={styles.row}
      aria-labelledby="patient-triage-title"
      data-testid="patient-triage-card"
      data-now-tile=""
    >
      <span className={styles.chip} aria-hidden="true">
        <Icon icon={ClipboardList} size={16} />
      </span>
      <div className={styles.text}>
        <div className={styles.top}>
          <h2 id="patient-triage-title" className={styles.title}>
            Triage and risk
          </h2>
          <span className={styles.meta}>{meta}</span>
        </div>
        {latest ? (
          <>
            <p className={styles.signed} data-testid="patient-triage-signed">
              {signedLine(latest, dayZero)}
            </p>
            <ul className={styles.facts} aria-label="Last signed triage">
              {triageRecordWords(latest).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className={styles.quiet}>No triage on record. Triage opens a blank form, with nothing pre-selected.</p>
        )}
      </div>
      {canTriage ? (
        <Link
          href={triageHrefFor(patientId)}
          className={`${buttonClass({ size: "sm" })} ${styles.action}`}
          data-testid="patient-triage-start"
        >
          Triage
        </Link>
      ) : null}
    </section>
  );
}
