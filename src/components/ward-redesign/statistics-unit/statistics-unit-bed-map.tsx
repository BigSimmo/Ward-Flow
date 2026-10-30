"use client";

import { CircleDashed } from "lucide-react";

import { SrOnly, StatusGlyph, cx } from "@/components/wf";
import { useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { STAY_BANDS } from "@/components/ward-management/ward-admissions";
import {
  BED_MAP_LABELS,
  type BedMap,
  type BedMapKind,
} from "@/components/ward-management/statistics/statistics-bed-map";
import base from "@/components/ward-management/statistics/statistics-bed-map.module.css";

import styles from "./statistics-unit.module.css";

/** The short word inside a tile with no stay to show (as in the app's bed map). */
const CELL_WORDS: Record<BedMapKind, string> = {
  occupied: "In bed",
  leave: "Leave",
  pulled: "Pulled",
  ready: "Ready",
  prep: "Preparing",
  closed: "Closed",
};

/** Which of the roster's own stay bands a whole-day stay falls in (the rule `stayBand` uses). */
function bandIndexOf(days: number): number {
  const index = STAY_BANDS.findIndex((band) => band.upToDays === null || days < band.upToDays);
  return index === -1 ? STAY_BANDS.length - 1 : index;
}

function CellGlyph({ kind }: { kind: BedMapKind }) {
  if (kind === "leave") return <StatusGlyph tone="neutral" size={9} />;
  if (kind === "pulled") return <StatusGlyph tone="info" size={9} />;
  if (kind === "ready") return <StatusGlyph tone="success" size={9} />;
  if (kind === "closed") return <StatusGlyph tone="closed" size={9} />;
  if (kind === "prep") return <CircleDashed size={9} aria-hidden="true" />;
  return null;
}

/**
 * Redesign: the ward's beds as small tiles, nine to a row, shaded darker the longer the stay (the
 * four stay bands of the Length of stay card). The cells come straight from the app's `bedMapCells`,
 * so the tiles still add up to the ward's beds; the state legend above stays the app's own.
 */
export function CompactBedMap({ map, wardName }: { map: BedMap; wardName: string }) {
  const { countsOnly, small } = useStatisticsCounts();
  // Executive desk (counts only): a tile keeps its bed state but names no admission, stay or blocker.
  const cells = countsOnly
    ? map.cells.map((entry) => ({ ...entry, admissionId: null, stayDays: null, longStay: false, blocked: false }))
    : map.cells;
  const blocked = cells.filter((entry) => entry.blocked).length;
  const said = (Object.keys(BED_MAP_LABELS) as BedMapKind[])
    .filter((kind) => map.counts[kind] > 0)
    .map((kind) => `${map.counts[kind]} ${BED_MAP_LABELS[kind].toLowerCase()}`)
    .join(", ");
  const unplaced = small(map.unplacedRecords);
  const titleOf = (entry: (typeof cells)[number]) => {
    const parts = [BED_MAP_LABELS[entry.kind]];
    if (entry.admissionId) parts.unshift(entry.admissionId);
    if (entry.stayDays !== null) parts.push(`${entry.stayDays} ${entry.stayDays === 1 ? "day" : "days"}`);
    if (entry.blocked) parts.push("discharge blocked");
    return parts.join(" · ");
  };
  return (
    <div className={base.map} data-testid="ward-statistics-bed-map">
      <SrOnly>
        {`${wardName} has ${cells.length} ${cells.length === 1 ? "bed" : "beds"}: ${said || "none recorded"}.`}
        {blocked > 0 ? ` ${blocked} of the people in a bed ${blocked === 1 ? "has" : "have"} a discharge blocker.` : ""}
      </SrOnly>
      <ol className={styles.bedGrid} aria-label={`${wardName} beds, one item per bed`}>
        {cells.map((entry, index) => (
          <li
            key={index}
            className={cx(styles.bedTile, base[entry.kind])}
            title={titleOf(entry)}
            data-bed-kind={entry.kind}
            data-stay-band={entry.stayDays === null ? undefined : bandIndexOf(entry.stayDays)}
            data-admission-id={entry.admissionId ?? undefined}
          >
            <SrOnly>{titleOf(entry)}</SrOnly>
            <span className={styles.bedGlyph} aria-hidden="true">
              <CellGlyph kind={entry.kind} />
            </span>
            {entry.stayDays !== null ? (
              <span className={styles.bedDays} aria-hidden="true">
                {entry.stayDays}d
              </span>
            ) : (
              <span className={styles.bedWord} aria-hidden="true">
                {CELL_WORDS[entry.kind]}
              </span>
            )}
            {entry.blocked ? (
              <span className={styles.bedBlocked} aria-hidden="true">
                <StatusGlyph tone="warning" size={9} />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <div className={styles.bedFoot}>
        {countsOnly ? null : (
          <ul className={styles.stayKey} aria-hidden="true">
            <li className={styles.stayKeyLabel}>Stay</li>
            {STAY_BANDS.map((band, index) => (
              <li key={band.id} className={styles.stayKeyItem}>
                <span className={styles.staySwatch} data-stay-band={index} />
                {band.label}
              </li>
            ))}
          </ul>
        )}
        <p className={base.note}>
          {countsOnly
            ? "Grouped by state. Bed numbers are not recorded."
            : "Grouped by state. Bed numbers are not recorded; hover a bed for its admission number, or see the admission roster."}
          {map.unplacedRecords > 0
            ? ` ${unplaced} recorded ${unplaced === 1 ? "admission is" : "admissions are"} not shown because the ward's bed count has no bed for ${unplaced === 1 ? "it" : "them"}.`
            : ""}
        </p>
      </div>
    </div>
  );
}
