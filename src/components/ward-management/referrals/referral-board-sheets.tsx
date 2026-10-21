"use client";

/**
 * The referral board's on-demand sheets (bed meeting list, ISBAR summary, keyboard shortcuts). They
 * open only from a button or a key, so the board loads them after first render.
 */
import { useState } from "react";
import { ClipboardCopy } from "lucide-react";

import type { Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { Button, Sheet, TierTile, cx } from "@/components/wf";

import {
  REFERRAL_SHORTCUTS,
  WaitCell,
  type BedsReadySummary,
  REFERRAL_SOURCE_WORDS,
  askingForShort,
  isOverdue,
  needWords,
  waitWords,
  type MeetingRow,
} from "./referral-board-parts";
import styles from "./referral-board.module.css";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

function meetingText(rows: MeetingRow[], now: Instant): string {
  return rows
    .map((row, index) => {
      const { waited, due } = waitWords(row.referral, now);
      return [
        `${index + 1}. T${row.referral.urgency} ${row.name}`,
        `waiting ${waited}, ${due}`,
        `from ${row.referral.originSiteCode}`,
        `asking for ${askingForShort(row.referral)}`,
        needWords(row.referral).join(", ") || "no bed needs recorded",
      ].join(" | ");
    })
    .join("\n");
}

/** Copies to the clipboard, then says so in the button. Clipboard refusals fall back to no change. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="pri"
      size="sm"
      icon={ClipboardCopy}
      onClick={() => {
        void copyTextToClipboard(text)
          .then(() => setCopied(true))
          .catch(() => setCopied(false));
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

export function BedMeetingSheet({
  open,
  onClose,
  rows,
  now,
  summary,
}: {
  open: boolean;
  onClose: () => void;
  rows: MeetingRow[];
  now: Instant;
  summary: BedsReadySummary;
}) {
  const overdue = rows.filter((row) => isOverdue(row.referral, now)).length;
  const tier1 = rows.filter((row) => row.referral.urgency === 1).length;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Bed meeting list"
      description="Queue order, longest wait first. Tier breaks ties."
      contentClassName={styles.meetingSheet}
      footer={
        <div className={styles.sheetFoot}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <CopyButton text={meetingText(rows, now)} label="Copy list" />
        </div>
      }
    >
      <div className={styles.meetingSummary}>
        <span>
          <b>{overdue}</b> overdue
        </span>
        <span>
          <b>{tier1}</b> tier 1
        </span>
        {summary.cells.slice(0, 3).map((cell) => (
          <span key={cell.label}>
            <b>{cell.value}</b> {cell.label.toLowerCase()} beds ready
          </span>
        ))}
      </div>
      <WardTable
        className={styles.meetingTable}
        wrapperClassName={styles.meetingScroll}
        testId="ward-referral-meeting-table"
        ariaLabel="Bed meeting list"
      >
        <thead>
          <tr>
            <th scope="col" className={styles.deskOnly}>
              #
            </th>
            <th scope="col">Tier</th>
            <th scope="col">Patient</th>
            <th scope="col">Since referral</th>
            <th scope="col" className={styles.deskOnly}>
              From
            </th>
            <th scope="col" className={styles.deskOnly}>
              Asking for
            </th>
            <th scope="col" className={styles.deskOnly}>
              Needs
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.referral.id} data-overdue={isOverdue(row.referral, now) ? "true" : undefined}>
              <td className={cx(styles.mono, styles.deskOnly)}>{index + 1}</td>
              <td>
                <TierTile tier={row.referral.urgency} />
              </td>
              <td>
                <span className={styles.who}>
                  <b>{row.name}</b>
                  <span>
                    <span className={styles.mono}>{row.umrn}</span>
                    <span className={styles.phoneOnly}>
                      {" "}
                      · {row.referral.originSiteCode} to {askingForShort(row.referral)}
                    </span>
                  </span>
                </span>
              </td>
              <td>
                <WaitCell referral={row.referral} now={now} />
              </td>
              <td className={cx(styles.mono, styles.deskOnly)} title={siteByCode(row.referral.originSiteCode)?.name}>
                {row.referral.originSiteCode}
              </td>
              <td className={styles.deskOnly}>{askingForShort(row.referral)}</td>
              <td className={styles.deskOnly}>{needWords(row.referral).join(", ") || "None recorded"}</td>
            </tr>
          ))}
        </tbody>
      </WardTable>
    </Sheet>
  );
}

/* ─── Selected referral: alerts, decision clock and ISBAR summary ───────────────────────────── */

function isbarText(referral: Referral, name: string, umrn: string, demographics: string, now: Instant): string {
  const intake = referral.intake;
  const { waited, due } = waitWords(referral, now);
  const site = siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode;
  return [
    `Identify: ${name}, ${umrn}, ${demographics}.`,
    `Situation: tier ${referral.urgency} referral from ${site} (${REFERRAL_SOURCE_WORDS[referral.source]}), waiting ${waited}, ${due}. Asking for ${askingForShort(referral)}.`,
    `Background: ${intake?.reasonForReferral?.trim() || "Reason not recorded"}. Legal status ${intake?.legalStatus?.trim() || "not recorded"}.`,
    `Assessment: risk flags ${intake?.riskFlags.join(", ") || "not recorded"}. Medical clearance ${intake ? (intake.medicalClearance.cleared ? "cleared" : "pending") : "not recorded"}.`,
    `Recommendation: ${needWords(referral).join(", ") || "no bed needs recorded"}.`,
  ].join("\n");
}

export function IsbarSheet({
  open,
  onClose,
  referral,
  name,
  umrn,
  demographics,
  now,
}: {
  open: boolean;
  onClose: () => void;
  referral: Referral;
  name: string;
  umrn: string;
  demographics: string;
  now: Instant;
}) {
  const text = isbarText(referral, name, umrn, demographics, now);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Referral summary"
      description="ISBAR, from what the referral records. Nothing here is inferred."
      footer={
        <div className={styles.sheetFoot}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <CopyButton text={text} label="Copy summary" />
        </div>
      }
    >
      <dl className={styles.isbar}>
        {text.split("\n").map((line) => {
          const [head, ...rest] = line.split(": ");
          return (
            <div key={head}>
              <dt>{head}</dt>
              <dd>{rest.join(": ")}</dd>
            </div>
          );
        })}
      </dl>
    </Sheet>
  );
}

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Keyboard shortcuts">
      <dl className={styles.keys}>
        {REFERRAL_SHORTCUTS.map(([key, words]) => (
          <div key={key}>
            <dt>
              {key.split(" ").map((part) => (
                <kbd key={part}>{part}</kbd>
              ))}
            </dt>
            <dd>{words}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}

/* ─── Selected referral: Patient tab ────────────────────────────────────────────────────────── */
