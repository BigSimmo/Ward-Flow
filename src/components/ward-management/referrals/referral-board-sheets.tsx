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
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
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
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";

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

/** Copies to the clipboard, then says so on the button and aloud; a refused copy says so too. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null);
  return (
    <Button
      variant="pri"
      size="sm"
      icon={ClipboardCopy}
      onClick={() => {
        // The result is said aloud as well as shown (design audit, Josh 1 Nov 2026); a refused copy
        // shows on the button rather than looking as if nothing happened.
        void copyTextToClipboard(text).then(
          () => {
            setResult("copied");
            announceToWardShell("Copied to the clipboard.");
          },
          () => {
            setResult("failed");
            announceToWardShell("Could not copy. Check clipboard access and try again.");
          },
        );
      }}
    >
      {result === "copied" ? "Copied" : result === "failed" ? "Could not copy" : label}
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
function isbarSections(
  referral: Referral,
  name: string,
  umrn: string,
  demographics: string,
  now: Instant,
  recorded: IsbarRecorded = {},
): { heading: string; paragraphs: string[] }[] {
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
  ];
  const flags = intake
    ? intake.riskFlags.join(", ") || "none selected"
    : "not recorded (raised before the referral form)";
  return [
    { heading: "Identify", paragraphs: [`${name}, ${umrn}, ${demographics}.`] },
    {
      heading: "Situation",
      paragraphs: [
        `Tier ${referral.urgency} referral from ${site} (${REFERRAL_SOURCE_WORDS[referral.source]}), waiting ${waited}, ${due}.`,
        `Asking for ${askingForShort(referral)}.`,
      ],
    },
    { heading: "Background", paragraphs: background },
    {
      heading: "Assessment",
      paragraphs: [
        `Risk flags on the referral letter ${flags}.`,
        `Medical clearance ${clearanceWords}.`,
        `Bed and transport requirements: ${needWords(referral).join(", ") || "not recorded"}.`,
      ],
    },
    { heading: "Recommendation", paragraphs: ["No separate recommendation recorded."] },
  ];
}

/** Plain-text and displayed summaries use the same recorded fields and source labels. */
export function isbarText(
  referral: Referral,
  name: string,
  umrn: string,
  demographics: string,
  now: Instant,
  recorded: IsbarRecorded = {},
): string {
  return isbarSections(referral, name, umrn, demographics, now, recorded)
    .map(({ heading, paragraphs }) => `${heading}: ${paragraphs.join(" ")}`)
    .join("\n");
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
  const sections = isbarSections(referral, name, umrn, demographics, now, recorded);
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
        {sections.map(({ heading, paragraphs }) => (
          <div key={heading}>
            <dt>{heading}</dt>
            <dd>
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Josh, 31 Oct 2026 (answer 35): M is off on the ED desk, so its list leaves it out.
  const edDesk = useEffectiveWardAccess().role === "ed";
  const shortcuts = edDesk ? REFERRAL_SHORTCUTS.filter(([key]) => key !== "M") : REFERRAL_SHORTCUTS;
  return (
    <Sheet open={open} onClose={onClose} title="Keyboard shortcuts">
      <dl className={styles.keys}>
        {shortcuts.map(([key, words]) => (
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
