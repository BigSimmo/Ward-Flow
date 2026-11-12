"use client";

import { Check, ChevronRight, Copy, Phone, Printer } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, Card, CardHead, useIsPhone, useIsTabletPortrait } from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

import type { CallRow } from "./patient-call-list";
import type { PatientMode } from "./patient-mode";
import { PatientStatusCard, type PatientStatusContext } from "./patient-status-card";
import { telHref } from "./patient-now-ward";
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
  statusCardProps?: Pick<
    Parameters<typeof PatientStatusCard>[0],
    "barLead" | "barMain" | "phoneFoot" | "quietActions" | "children"
  >;
  /** Josh, 3 Nov 2026: the one thing due now leads Now, above the status card, on every device. */
  nextStep?: ReactNode;
  /** Discharge readiness (on the ward only). */
  readiness?: ReactNode;
  /** Last 24 hours of recorded events for the stay. */
  recent?: ReactNode;
  legal: ReactNode;
  why: ReactNode;
  /** Version 2 (12 Nov 2026): the leave steps or the absence record, in the side column on desktop. */
  absence?: ReactNode;
  /** Record a change and the record overview, in that order. */
  change: ReactNode;
  calls: CallRow[];
  /** Rows under the work: destination and transport sheets, Review and corrections. */
  sheetRows: ReactNode;
  /** Phone only: Community and Details one tap away. */
  phoneMore?: ReactNode;
  /** Bed meeting actions due for this patient: each its own card above the small rows. */
  notices?: ReactNode;
  /** Redesign (12 Nov 2026): triage and carer call back, joined as rows of one card. */
  tiles?: ReactNode;
  /** Care and safety. */
  care?: ReactNode;
  /** Handover pack and the patient or carer page, as one card in the side column. */
  handover?: ReactNode;
};

export function PatientNowLayout({
  mode,
  context,
  statusCardProps,
  nextStep,
  readiness,
  recent,
  legal,
  why,
  absence,
  change,
  calls,
  sheetRows,
  phoneMore,
  notices,
  tiles,
  care,
  handover,
}: PatientNowLayoutParts) {
  const isPhone = useIsPhone();
  const isPortrait = useIsTabletPortrait();
  const card = <PatientStatusCard mode={mode} context={context} {...statusCardProps} />;
  const callCard = <PatientCallCard rows={calls} />;
  // Redesign (12 Nov 2026): Now is a dashboard grid. The work leads in the main column, triage and
  // carer call back follow as rows of one card, and the side column holds what people look up
  // (legal, who to call, hand over). Nothing stretches the full width of the page.
  const tileRow = tiles ? <div className={styles.tiles}>{tiles}</div> : null;
  // Version 2: the status card and the rows that open its sheets are one card, the links its foot.
  const work = (
    <div className={styles.work}>
      {card}
      {sheetRows ? <div className={styles.across}>{sheetRows}</div> : null}
    </div>
  );
  const handoverCard = handover ? (
    <Card className={styles.handover} data-testid="ward-patient-hand-over">
      <CardHead level={2} icon={Printer} title="Hand over and print" />
      <div className={styles.handoverRows}>{handover}</div>
    </Card>
  ) : null;
  if (isPhone)
    return (
      <div className={styles.stack}>
        {nextStep}
        {card}
        {sheetRows}
        {notices}
        {tileRow}
        {legal}
        {readiness}
        {recent}
        {callCard}
        {absence}
        {change}
        {care}
        {handoverCard}
        {phoneMore}
      </div>
    );
  if (isPortrait)
    return (
      <div className={styles.stack}>
        {nextStep}
        {work}
        {notices}
        {tileRow}
        <div className={styles.twoUp}>
          {legal || readiness ? (
            <div className={styles.col}>
              {legal}
              {readiness}
              {why}
            </div>
          ) : (
            why
          )}
          {callCard}
        </div>
        {recent}
        {absence}
        {change}
        {care}
        {handoverCard}
      </div>
    );
  return (
    <div className={styles.cols} data-now-dash="">
      <div className={styles.col}>
        {nextStep}
        {work}
        {notices}
        {tileRow}
        {change}
        {care}
      </div>
      {/* Not the shared `data-wf-rail`: that caps the column at the window and scrolls it inside
          itself, which cut Who to call off when this column was the longer one (Josh, 19 Oct 2026). */}
      <div className={`${styles.col} ${styles.rail}`}>
        {legal}
        {readiness}
        {absence}
        {callCard}
        {recent}
        {why}
        {handoverCard}
      </div>
    </div>
  );
}

/* ---------------- Who to call ---------------- */

function PatientCallCard({ rows, title = "Who to call" }: { rows: CallRow[]; title?: string }) {
  // Josh, 3 Nov 2026: each number is tap to call (a tel: link) with a small Copy beside it. The
  // numbers are synthetic, in the unassigned (08) 0000 exchange.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  function copy(row: CallRow, number: string) {
    copyTextToClipboard(number).then(
      () => {
        setFailedKey(null);
        setCopiedKey(row.key);
      },
      () => {
        setCopiedKey(null);
        setFailedKey(row.key);
      },
    );
  }
  return (
    <Card data-testid="ward-patient-who-to-call">
      <CardHead level={2} icon={Phone} title={title} meta="Synthetic numbers" />
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
                  <a
                    className={`${styles.mono} ${styles.tel}`}
                    href={telHref(row.number)}
                    aria-label={`Call ${row.name}, ${row.number}`}
                    data-testid="ward-patient-call-number"
                  >
                    {row.number}
                  </a>
                ) : (
                  <span className={styles.callRole}>No line held</span>
                )}
                {failedKey === row.key ? (
                  <span className={styles.callRole} role="status">
                    Not copied
                  </span>
                ) : row.hours ? (
                  <span className={styles.callRole}>{row.hours}</span>
                ) : null}
              </span>
              {row.number ? (
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={copiedKey === row.key ? Check : Copy}
                  aria-label={copiedKey === row.key ? `Copied ${row.name}'s number` : `Copy ${row.name}'s number`}
                  onClick={() => copy(row, row.number!)}
                />
              ) : (
                <span />
              )}
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
