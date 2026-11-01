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
}: {
  rows: readonly Row[];
  unitName: string;
  mark: (bedNumber: number) => WalkRoundMark;
  walkFrom: (bedNumber: number) => void;
  isLit: (row: Row) => boolean;
  rowLabel: (name: string, marks: WalkRoundMark) => string;
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
          return (
            <li key={row.bed.bedNumber}>
              <button
                type="button"
                className={styles.phoneRow}
                data-act={row.glyph === "danger" ? "true" : undefined}
                data-dim={isLit(row) ? undefined : "true"}
                data-reviewed={marks.reviewed ? "true" : undefined}
                aria-label={rowLabel(row.accessibleName, marks)}
                onClick={() => {
                  walkFrom(Number(row.bed.bedNumber));
                }}
              >
                <span className={styles.phoneRowNo} aria-hidden="true">
                  {row.number}
                </span>
                <span className={styles.phoneRowText} aria-hidden="true">
                  <span className={styles.phoneRowName}>
                    {readyOnce(row) && row.glyph ? (
                      <>
                        <StatusGlyph tone={row.glyph} size={9} />{" "}
                      </>
                    ) : null}
                    {row.name}
                  </span>
                  <WalkRoundRowMarks mark={marks} />
                  {/* Phone audit (Josh, 1 Nov 2026): a ready bed says "Ready" once, in its name line. */}
                  {readyOnce(row) ? null : (
                    <span className={styles.phoneRowNote}>
                      {row.glyph ? <StatusGlyph tone={row.glyph} size={9} /> : null}
                      <span>
                        {row.bed.stayDays === 0 && row.note === row.stateWord
                          ? "Arrived today"
                          : row.note === row.name
                            ? row.free
                              ? "Ready"
                              : row.bed.status === "closed"
                                ? "Not offered"
                                : row.stateWord
                            : row.note}
                      </span>
                      {row.criteriaTag ? <CriteriaLedTag chip={row.criteriaTag} /> : null}
                    </span>
                  )}
                </span>
                <span className={styles.phoneRowDays} aria-hidden="true">
                  {row.days || (row.free && !readyOnce(row) ? "Ready" : "")}
                  {row.days && !row.free ? <span className={styles.phoneRowDaysSub}>stay</span> : null}
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
