"use client";

// WH9 (Josh, 3 Nov 2026): the ward coordinator's other jobs, under the decisions due. Ward handover
// opens the one Handover page, filtered to this ward; it is never a second handover.

import Link from "next/link";
import { Bell, FileText, Inbox, Printer, SquareCheck } from "lucide-react";
import { buttonClass, cx, StatusGlyph } from "@/components/wf";
import styles from "./ward-screen-decision-jobs.module.css";

type WardScreenDecisionJobsProps = {
  unitName: string;
  handoverHref: string;
  capacityLine: string;
  /** Confirmed this shift: the job is done, so its button offers an update. */
  capacityDone: boolean;
  onConfirmCapacity: () => void;
  referralsWaiting: number;
  onOpenReferrals: () => void;
  unreadNotices: number;
  onOpenNotices: () => void;
  onOpenShiftBrief: () => void;
};

export function WardScreenDecisionJobs({
  unitName,
  handoverHref,
  capacityLine,
  capacityDone,
  onConfirmCapacity,
  referralsWaiting,
  onOpenReferrals,
  unreadNotices,
  onOpenNotices,
  onOpenShiftBrief,
}: WardScreenDecisionJobsProps) {
  const job = cx(buttonClass({ variant: "sec", size: "sm" }), styles.jobAction);
  return (
    <section className={styles.strip} aria-labelledby="ward-decision-jobs" data-testid="ward-decision-jobs">
      <div className={styles.head}>
        <h2 id="ward-decision-jobs" className={styles.caps}>
          Ward coordinator jobs
        </h2>
        <Link
          className={cx(buttonClass({ variant: "sec", size: "sm" }), styles.handover)}
          href={handoverHref}
          data-testid="ward-decisions-handover"
          aria-label={`Ward handover, opens Handover for ${unitName}`}
        >
          <Printer strokeWidth={1.75} size={16} aria-hidden="true" />
          Ward handover
        </Link>
      </div>
      <ul className={styles.jobs}>
        <li className={styles.job}>
          <span className={styles.jobText}>
            <span className={styles.jobTitle}>
              <StatusGlyph tone={capacityDone ? "success" : "warning"} size={9} />
              Capacity
            </span>
            <span className={styles.jobLine}>{capacityLine}</span>
          </span>
          <button type="button" className={job} onClick={onConfirmCapacity}>
            <SquareCheck strokeWidth={1.75} size={14} aria-hidden="true" />
            {capacityDone ? "Update" : "Confirm"}
          </button>
        </li>
        <li className={styles.job}>
          <span className={styles.jobText}>
            <span className={styles.jobTitle}>
              <StatusGlyph tone={referralsWaiting > 0 ? "warning" : "success"} size={9} />
              Referrals
            </span>
            <span className={styles.jobLine}>{referralsWaiting} waiting for an answer</span>
          </span>
          <button type="button" className={job} onClick={onOpenReferrals}>
            <Inbox strokeWidth={1.75} size={14} aria-hidden="true" />
            Open
          </button>
        </li>
        <li className={styles.job}>
          <span className={styles.jobText}>
            <span className={styles.jobTitle}>
              <StatusGlyph tone={unreadNotices > 0 ? "info" : "neutral"} size={9} />
              Notices
            </span>
            <span className={styles.jobLine}>{unreadNotices} unread</span>
          </span>
          <button type="button" className={job} aria-haspopup="dialog" onClick={onOpenNotices}>
            <Bell strokeWidth={1.75} size={14} aria-hidden="true" />
            Read
          </button>
        </li>
        <li className={styles.job}>
          <span className={styles.jobText}>
            <span className={styles.jobTitle}>
              <StatusGlyph tone="neutral" size={9} />
              Shift brief
            </span>
            <span className={styles.jobLine}>One page for the next shift</span>
          </span>
          <button type="button" className={job} aria-haspopup="dialog" onClick={onOpenShiftBrief}>
            <FileText strokeWidth={1.75} size={14} aria-hidden="true" />
            Open
          </button>
        </li>
      </ul>
    </section>
  );
}
