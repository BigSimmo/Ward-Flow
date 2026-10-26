"use client";

/**
 * The referral board's on-demand sheets (bed meeting list, ISBAR summary, keyboard shortcuts). They
 * open only from a button or a key, so the board loads them after first render.
 */
import { useState } from "react";
import { ClipboardCopy } from "lucide-react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
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
import { UNIDENTIFIED_REFERRAL_PREFIX } from "./referral-inbox";
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

/** The referrer's Patient story on one line, less the "Not yet identified, …" line the drawer puts first. */
function patientStory(referral: Referral): string {
  const lines = referral.history.split("\n");
  const body = lines[0]?.trim().startsWith(UNIDENTIFIED_REFERRAL_PREFIX) ? lines.slice(1) : lines;
  return body.join(" ").replace(/\s+/g, " ").trim();
}

/** What the current record holds, apart from what the referral letter said when it was sent. */
export type IsbarRecorded = {
  legalStatus?: string;
  clearance?: { cleared: boolean; at: Instant };
};

/**
 * Audit CS3-02: the letter's legal status and clearance were shown as if they were the record. The
 * summary now gives the recorded legal status and clearance, or "not recorded", and names what came
 * from the letter as the letter's.
 *
 * #836: Background reads both fields the referral form's Clinical presentation card writes (Reason
 * for referral and Patient story), and a blank one is named, so "not recorded" says which field.
 */
export function isbarText(
  referral: Referral,
  name: string,
  umrn: string,
  demographics: string,
  now: Instant,
  recorded: IsbarRecorded = {},
): string {
  const intake = referral.intake;
  const { waited, due } = waitWords(referral, now);
  const site = siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode;
  const reason = intake?.reasonForReferral?.replace(/\s+/g, " ").trim();
  const story = patientStory(referral);
  const letterLegal = intake?.legalStatus?.trim();
  const legal = recorded.legalStatus?.trim();
  const clearance = recorded.clearance;
  const clearanceWords = clearance
    ? `${clearance.cleared ? "cleared" : "not cleared"}, recorded ${formatInstantWithDay(clearance.at, now)}`
    : "not recorded";
  const background = [
    reason ? `On the referral letter, ${reason.replace(/\.$/, "")}.` : "Reason for referral not recorded.",
    story ? `Patient story: ${story.replace(/\.$/, "")}.` : "Patient story not recorded.",
    `Legal status ${legal || "not recorded"}${letterLegal ? ` (on the referral letter: ${letterLegal})` : ""}.`,
  ].join(" ");
  const flags = intake
    ? intake.riskFlags.join(", ") || "none selected"
    : "not recorded (raised before the referral form)";
  return [
    `Identify: ${name}, ${umrn}, ${demographics}.`,
    `Situation: tier ${referral.urgency} referral from ${site} (${REFERRAL_SOURCE_WORDS[referral.source]}), waiting ${waited}, ${due}. Asking for ${askingForShort(referral)}.`,
    `Background: ${background}`,
    `Assessment: risk flags on the referral letter ${flags}. Medical clearance ${clearanceWords}.`,
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
  recorded,
}: {
  open: boolean;
  onClose: () => void;
  referral: Referral;
  name: string;
  umrn: string;
  demographics: string;
  now: Instant;
  recorded?: IsbarRecorded;
}) {
  const text = isbarText(referral, name, umrn, demographics, now, recorded);
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
