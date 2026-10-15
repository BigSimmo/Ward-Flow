"use client";

import { ChevronRight, Phone, PhoneCall } from "lucide-react";
import type { ReactNode } from "react";

import { useOptionalToast } from "@/components/wf";
import { Card, CardHead, useIsPhone, useIsTabletPortrait } from "@/components/wf";

import type { CallRow } from "./patient-call-list";
import type { PatientMode } from "./patient-mode";
import { PatientStatusCard, type PatientStatusContext } from "./patient-status-card";
import styles from "./patient-now-layouts.module.css";

/**
 * Patient Now (device audit 11 Oct 2026, Patient; owner pick A). The status card leads with the
 * one next step. The Transit operations, Destination review and Transport dispatch block is off
 * Now: destination and transport open as sheets from their rows. Who to call shows each mock
 * number with a call button. Legal now and Who to call sit in the rail on desktop, two-up on iPad
 * portrait, and after the status card on phone.
 */

export type PatientNowLayoutParts = {
  mode: PatientMode;
  context: PatientStatusContext;
  /** Status card props the screen already builds (phone bar lead, foot line). */
  statusCardProps?: Pick<Parameters<typeof PatientStatusCard>[0], "barLead" | "barMain" | "phoneFoot">;
  legal: ReactNode;
  why: ReactNode;
  /** Record a change, leave and absence cards, and the record overview, in that order. */
  change: ReactNode;
  calls: CallRow[];
  /** Rows under the work: destination and transport sheets, Review and corrections. */
  sheetRows: ReactNode;
  /** Phone only: Community and Details one tap away. */
  phoneMore?: ReactNode;
};

export function PatientNowLayout({
  mode,
  context,
  statusCardProps,
  legal,
  why,
  change,
  calls,
  sheetRows,
  phoneMore,
}: PatientNowLayoutParts) {
  const isPhone = useIsPhone();
  const isPortrait = useIsTabletPortrait();
  const card = <PatientStatusCard mode={mode} context={context} {...statusCardProps} />;
  const callCard = <PatientCallCard rows={calls} />;
  if (isPhone)
    return (
      <div className={styles.stack}>
        {card}
        {sheetRows}
        {legal}
        {callCard}
        {change}
        {phoneMore}
      </div>
    );
  if (isPortrait)
    return (
      <div className={styles.stack}>
        {card}
        <div className={styles.twoUp}>
          {legal}
          {callCard}
        </div>
        {sheetRows}
        {change}
        {why}
      </div>
    );
  return (
    <div className={styles.stack}>
      {card}
      <div className={styles.cols}>
        <div className={styles.col}>
          {sheetRows}
          {change}
        </div>
        <div className={styles.col} data-wf-rail="1121">
          {why}
          {legal}
          {callCard}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Who to call ---------------- */

function CallButton({ row }: { row: CallRow }) {
  const toast = useOptionalToast();
  if (!row.number) return null;
  const number = row.number;
  return (
    <button
      type="button"
      className={styles.call}
      aria-label={`Call ${row.name}, ${number}`}
      onClick={() => {
        void navigator.clipboard?.writeText(number).catch(() => undefined);
        toast?.push({ tone: "info", title: "Number copied", body: "Not wired in this prototype." });
      }}
    >
      <PhoneCall size={20} aria-hidden="true" />
    </button>
  );
}

function PatientCallCard({ rows, title = "Who to call" }: { rows: CallRow[]; title?: string }) {
  return (
    <Card data-testid="ward-patient-who-to-call">
      <CardHead level={2} icon={Phone} title={title} meta="Mock numbers" />
      {rows.length > 0 ? (
        <ul className={styles.calls}>
          {rows.map((row) => (
            <li key={row.key} className={styles.callRow}>
              <span className={styles.callText}>
                <b className={styles.callName}>{row.name}</b>
                <span className={styles.callRole}>{row.role}</span>
              </span>
              <span className={styles.callNumber}>
                {row.number ? (
                  <b className={styles.mono}>{row.number}</b>
                ) : (
                  <span className={styles.callRole}>No line held</span>
                )}
                {row.hours ? <span className={styles.callRole}>{row.hours}</span> : null}
              </span>
              <CallButton row={row} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No contacts recorded for this record.</p>
      )}
    </Card>
  );
}

/** A row that opens a sheet (Destination, Transport, Review and corrections). */
export function PatientSheetRow({
  icon,
  title,
  sub,
  onOpen,
  testId,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  onOpen: () => void;
  testId?: string;
}) {
  return (
    <button type="button" className={styles.sheetRow} onClick={onOpen} data-testid={testId}>
      <span className={styles.sheetIcon}>{icon}</span>
      <span className={styles.callText}>
        <b className={styles.callName}>{title}</b>
        <span className={styles.callRole}>{sub}</span>
      </span>
      <ChevronRight size={16} aria-hidden="true" className={styles.chevron} />
    </button>
  );
}

export function PatientSheetRows({ children }: { children: ReactNode }) {
  return <div className={styles.sheetRows}>{children}</div>;
}
