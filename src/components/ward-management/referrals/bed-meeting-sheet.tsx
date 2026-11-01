"use client";
// Referrals redesign, round 4 (Josh, 31 October 2026): BedMeetingSheet copied from
// src/components/ward-management/referrals/referral-board-sheets.tsx. Changed: the list follows
// what the desk can see and what it has chosen. It keeps to the header's service (Statewide or one
// health service, by the referring site), opens on the highlighted referrals when a highlight is
// on (with a switch back to the whole queue), withholds destination details the desk is not
// allowed to see (in the table and in the copied text), and names its scope in the heading.

import { useState } from "react";
import { ClipboardCopy, Lock } from "lucide-react";

import type { Instant } from "@/components/ward-management/ward-clock";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import {
  WaitCell,
  askingForShort,
  isOverdue,
  needWords,
  waitWords,
  type BedsReadySummary,
  type MeetingRow,
} from "./referral-board-parts";
import { Button, Segmented, Sheet, TierTile, cx } from "@/components/wf";
import styles from "./referral-board.module.css";

import s from "./bed-meeting-sheet.module.css";

/** A row the desk can see, with whether its destination details are withheld. */
export type ScopedMeetingRow = MeetingRow & { restricted: boolean };

const WITHHELD = "Not shown at this desk";

function meetingText(rows: ScopedMeetingRow[], now: Instant, heading: string): string {
  return [
    heading,
    ...rows.map((row, index) => {
      const { waited, due } = waitWords(row.referral, now);
      return [
        `${index + 1}. T${row.referral.urgency} ${row.name}`,
        `waiting ${waited}, ${due}`,
        `from ${row.referral.originSiteCode}`,
        row.restricted ? WITHHELD : `asking for ${askingForShort(row.referral)}`,
        row.restricted ? undefined : needWords(row.referral).join(", ") || "no bed needs recorded",
      ]
        .filter(Boolean)
        .join(" | ");
    }),
  ].join("\n");
}

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
  highlightedIds,
  highlightLabel,
  scopeLabel,
  now,
  summary,
}: {
  open: boolean;
  onClose: () => void;
  /** Every queued referral in the desk's scope, queue order. */
  rows: ScopedMeetingRow[];
  /** The highlighted referrals, when a highlight is on. */
  highlightedIds?: ReadonlySet<string>;
  highlightLabel?: string;
  /** "Statewide" or the chosen health service. */
  scopeLabel: string;
  now: Instant;
  summary: BedsReadySummary;
}) {
  const filtered = highlightedIds ? rows.filter((row) => highlightedIds.has(row.referral.id)) : rows;
  const [chosen, setChosen] = useState<"filtered" | "all">("filtered");
  const showing = highlightedIds && chosen === "filtered" ? "filtered" : "all";
  const shown = showing === "filtered" ? filtered : rows;
  const overdue = shown.filter((row) => isOverdue(row.referral, now)).length;
  const tier1 = shown.filter((row) => row.referral.urgency === 1).length;
  const withheld = shown.filter((row) => row.restricted).length;
  const heading =
    showing === "filtered" && highlightLabel
      ? `Bed meeting list · ${scopeLabel} · ${highlightLabel} (${shown.length} of ${rows.length})`
      : `Bed meeting list · ${scopeLabel} (${shown.length})`;
  return (
    <Sheet
      open={open}
      onClose={() => {
        setChosen("filtered");
        onClose();
      }}
      title="Bed meeting list"
      description={`${scopeLabel} · longest wait first, tier breaks ties`}
      contentClassName={styles.meetingSheet}
      footer={
        <div className={styles.sheetFoot}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <CopyButton text={meetingText(shown, now, heading)} label={`Copy ${shown.length}`} />
        </div>
      }
    >
      {highlightedIds ? (
        <div className={s.scope}>
          <Segmented
            label="Which referrals"
            value={showing}
            onChange={setChosen}
            items={[
              { id: "filtered", label: highlightLabel ?? "Highlighted", count: filtered.length },
              { id: "all", label: "Whole queue", count: rows.length },
            ]}
          />
        </div>
      ) : null}
      <div className={styles.meetingSummary}>
        <span className={overdue > 0 ? s.hot : undefined}>
          <b>{overdue}</b> overdue
        </span>
        <span className={tier1 > 0 ? s.warm : undefined}>
          <b>{tier1}</b> tier 1
        </span>
        {summary.cells.slice(0, 3).map((cell) => (
          <span key={cell.label}>
            <b>{cell.value}</b> {cell.label.toLowerCase()} beds ready
          </span>
        ))}
      </div>
      {withheld > 0 ? (
        <p className={s.note}>
          <Lock size={12} aria-hidden="true" /> {withheld} {withheld === 1 ? "row hides" : "rows hide"} where the person
          is asking to go. This desk does not see it.
        </p>
      ) : null}
      {shown.length === 0 ? (
        <p className={s.empty}>No referrals waiting in {scopeLabel}.</p>
      ) : (
        <WardTable
          className={cx(styles.meetingTable, s.table)}
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
            {shown.map((row, index) => (
              <tr key={row.referral.id} data-overdue={isOverdue(row.referral, now) ? "true" : undefined}>
                <td className={cx(styles.mono, styles.deskOnly)}>{index + 1}</td>
                <td>
                  <TierTile tier={row.referral.urgency} />
                </td>
                <td>
                  <span className={cx(styles.who, s.who)}>
                    <b>{row.name}</b>
                    <span>
                      <span className={styles.mono}>{row.umrn}</span>
                      <span className={styles.phoneOnly}>
                        {" "}
                        · {row.referral.originSiteCode}
                        {row.restricted ? "" : ` to ${askingForShort(row.referral)}`}
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
                {row.restricted ? (
                  <td className={cx(styles.deskOnly, s.withheld)} colSpan={2}>
                    <Lock size={12} aria-hidden="true" /> {WITHHELD}
                  </td>
                ) : (
                  <>
                    <td className={styles.deskOnly}>{askingForShort(row.referral)}</td>
                    <td className={styles.deskOnly}>{needWords(row.referral).join(", ") || "None recorded"}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </WardTable>
      )}
    </Sheet>
  );
}
