"use client";
// Fork of src/components/ward-management/coordinator/chosen-alert-card.tsx for the Home mock-up. The
// one change: a "Legal due time passed" alert reads "Form 4C (Transfer order) · ended 10:02 as typed",
// never "1h 15m overdue" or "1h 15m ago" (Josh, 31 Oct 2026).

// The alert chosen in Home's "My list" (approved Home mock-up v7, 22 Oct 2026), shown
// above Placement so the coordinator keeps the reason in view while acting on the patient.

import Link from "next/link";
import { X } from "lucide-react";

import { alertDetail, alertKindLabel, minutesText } from "@/components/ward-management/alerts/alerts-model";
import { ownerShort, type QueueEntry } from "@/components/ward-management/alerts/alerts-queue";
import type { Instant } from "@/components/ward-management/ward-clock";
import { Button, buttonClass, Card, CardHead, StatusGlyph } from "@/components/wf";

import styles from "@/components/ward-management/coordinator/home-list.module.css";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import {
  legalAlertDetail,
  legalAlertDueAt,
  legalAlertEnded,
} from "@/components/ward-redesign/legal-copies/legal-alert-words";

/** `onClear` is left out inside a sheet, which has its own Close. */
export function ChosenAlertCard({ entry, now, onClear }: { entry: QueueEntry; now: Instant; onClear?: () => void }) {
  const kindLabel = alertKindLabel(entry.item.id);
  const inPlacement = Boolean(entry.movement);
  // Mock-up (Josh, 31 Oct 2026): a passed legal form reads as typed, with no "… ago" or overdue count.
  const legalDueAt = legalAlertDueAt(entry);
  const age =
    legalDueAt !== undefined
      ? legalAlertEnded(legalDueAt, now)
      : entry.raised === undefined
        ? "time not recorded"
        : `${minutesText(Math.max(0, now - entry.raised))} ago`;
  return (
    <Card className={styles.alertCard} data-testid="home-chosen-alert" aria-label="Chosen alert">
      <CardHead
        title="Chosen alert"
        meta={kindLabel ? `${kindLabel} · ${age}` : age}
        action={
          onClear ? (
            <Button size="sm" variant="ghost" icon={X} onClick={onClear} aria-label="Clear the chosen alert">
              Clear
            </Button>
          ) : undefined
        }
      />
      <div className={styles.alertBody}>
        <p className={styles.alertTitle}>
          <StatusGlyph tone={entry.group === "act" ? "danger" : "warning"} />
          {entry.item.title}
        </p>
        <p className={styles.alertDetail}>
          {legalDueAt !== undefined ? (
            <>
              {legalAlertDetail(entry, legalDueAt, now)} <LegalLimitsNotChecked variant="tag" />
            </>
          ) : (
            alertDetail(entry.item)
          )}
        </p>
        {/* With a patient open in Placement below, the patient, origin and destination are already
            there, so the card keeps only the reason, who owns it when that is not you, and what to do. */}
        {inPlacement ? (
          entry.mine || entry.owner === "Bed coordinator" ? null : (
            <p className={styles.alertDetail}>{`Owned by ${ownerShort(entry.owner)}`}</p>
          )
        ) : (
          <dl className={styles.alertFacts}>
            <div>
              <dt>Patient</dt>
              <dd>
                {entry.subject.displayName} <span className={styles.mono}>{entry.subject.umrn}</span>
              </dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{ownerShort(entry.owner)}</dd>
            </div>
            <div>
              <dt>From</dt>
              <dd>{entry.subject.from}</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>{entry.subject.to ?? "No destination yet"}</dd>
            </div>
          </dl>
        )}
        {inPlacement ? (
          <p className={styles.alertNext}>
            {entry.action.kind === "release"
              ? `${entry.action.label}: use Move or release in Placement below.`
              : `${entry.subject.displayName} is open in Placement below.`}
          </p>
        ) : entry.action.kind === "link" ? (
          <div className={styles.alertActs}>
            <Link href={entry.action.href} className={buttonClass({ size: "sm", variant: "pri" })}>
              {entry.action.label}
            </Link>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
