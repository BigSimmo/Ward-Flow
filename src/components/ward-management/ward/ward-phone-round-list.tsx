"use client";

// My ward's phone bed list (the round list), split out of `ward-home-tab.tsx` (31 October 2026) to
// keep that file under its line cap. The redesign (approved 31 Oct 2026) shows the first beds in
// bed order, then Show more.

import { useState } from "react";

import type { CriteriaLedChip } from "@/components/ward-management/ward-discharge-criteria";
import { ShowMoreRow, StatusGlyph, type WfTone } from "@/components/wf";

import type { BedItem } from "./ward-bed-tone";
import { CriteriaLedTag } from "./ward-criteria-led-tag";
import styles from "./ward-home-tab.module.css";
import outageTag from "./ward-outage-bed-tag.module.css";
import { NOT_CONFIRMED_SINCE_OUTAGE } from "@/components/ward-management/use-outage-catch-up";
import { WalkRoundRowMarks, WalkRoundTick, type WalkRoundMark } from "./ward-walk-round";

/** Beds the phone round list shows before Show more. */
const ROUND_FIRST = 8;

/** The parts of a Home bed row the phone list draws. */
export type PhoneRoundRow = {
  bed: BedItem;
  free: boolean;
  stateWord: string;
  days: string;
  note: string;
  criteriaTag: CriteriaLedChip | null;
  glyph: WfTone | null | undefined;
  number: string;
  name: string;
  accessibleName: string;
};

/** The note line's words: the arrival, the ready or closed word, or the row's own note. */
function roundNote(row: PhoneRoundRow): string {
  if (row.bed.stayDays === 0 && row.note === row.stateWord) return "Arrived today";
  if (row.note !== row.name) return row.note;
  if (row.free) return "Ready";
  return row.bed.status === "closed" ? "Not offered" : row.stateWord;
}

/** A ready bed whose name line already reads "Ready": no second note line and no "Ready" days column. */
function readyOnce(row: PhoneRoundRow): boolean {
  return row.free && row.name === "Ready" && row.note === row.name && !row.criteriaTag;
}

export function WardPhoneRoundList<Row extends PhoneRoundRow>({
  rows,
  unitName,
  mark,
  walkFrom,
  isLit,
  rowLabel,
  outage = false,
}: {
  rows: readonly Row[];
  unitName: string;
  mark: (bedNumber: number) => WalkRoundMark;
  walkFrom: (bedNumber: number) => void;
  isLit: (row: Row) => boolean;
  rowLabel: (name: string, marks: WalkRoundMark) => string;
  /** Batch 4 item 25 (D-142): every bed reads "Not confirmed since the outage" until the ward confirms. */
  outage?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const ordered = [...rows].sort((left, right) => Number(left.bed.bedNumber) - Number(right.bed.bedNumber));
  const hidden = showAll ? 0 : Math.max(0, ordered.length - ROUND_FIRST);
  return (
    <>
      <ul
        className={styles.phoneRows}
        aria-label={`Beds at ${unitName}, in bed order`}
        data-testid="ward-phone-round-list"
      >
        {ordered.slice(0, ordered.length - hidden).map((row) => {
          const marks = mark(Number(row.bed.bedNumber));
          const days = row.days || (row.free && !readyOnce(row) ? "Ready" : "");
          // axe 4.14 (label-content-name-mismatch): no aria-label, so the row is named by the words it
          // shows, in order, and a row cut by the screen's edge still matches its name. The round's own
          // words (and a tag's full phrase) follow for a screen reader only.
          const spoken = [row.criteriaTag?.phrase ?? "", rowLabel("", { ...marks, changed: false })]
            .filter(Boolean)
            .join(", ");
          return (
            <li key={row.bed.bedNumber}>
              <button
                type="button"
                className={styles.phoneRow}
                data-act={row.glyph === "danger" ? "true" : undefined}
                data-dim={isLit(row) ? undefined : "true"}
                data-reviewed={marks.reviewed ? "true" : undefined}
                onClick={() => {
                  walkFrom(Number(row.bed.bedNumber));
                }}
              >
                {/* The spaces keep the words apart; the row is a grid, where they take no room. */}
                <span className={styles.phoneRowNo}>
                  <span className="sr-only">Bed</span> {row.number}
                </span>{" "}
                <span className={styles.phoneRowText}>
                  <span className={styles.phoneRowName}>
                    {readyOnce(row) && row.glyph ? (
                      <>
                        <StatusGlyph tone={row.glyph} size={9} />{" "}
                      </>
                    ) : null}
                    {row.name}
                  </span>{" "}
                  <WalkRoundRowMarks mark={marks} />{" "}
                  {/* Phone audit (Josh, 1 Nov 2026): a ready bed says "Ready" once, in its name line. */}
                  {readyOnce(row) ? null : (
                    <span className={styles.phoneRowNote}>
                      {row.glyph ? <StatusGlyph tone={row.glyph} size={9} /> : null}
                      <span>{roundNote(row)}</span> {row.criteriaTag ? <CriteriaLedTag chip={row.criteriaTag} /> : null}
                    </span>
                  )}
                  {outage ? (
                    <>
                      {" "}
                      <span className={outageTag.row}>{NOT_CONFIRMED_SINCE_OUTAGE}</span>
                    </>
                  ) : null}
                </span>{" "}
                <span className={styles.phoneRowDays}>
                  {days}
                  {row.days && !row.free ? (
                    <>
                      {" "}
                      <span className={styles.phoneRowDaysSub}>stay</span>
                    </>
                  ) : null}
                  {spoken ? <span className="sr-only">{`, ${spoken}`}</span> : null}
                </span>
                <WalkRoundTick mark={marks} />
              </button>
            </li>
          );
        })}
      </ul>
      {ordered.length > ROUND_FIRST ? (
        <ShowMoreRow onClick={() => setShowAll((all) => !all)} expanded={showAll}>
          {showAll ? "Show fewer beds" : `Show ${hidden} more ${hidden === 1 ? "bed" : "beds"}`}
        </ShowMoreRow>
      ) : null}
    </>
  );
}
