"use client";

import type { CSSProperties } from "react";

import { SrOnly, StatusGlyph } from "@/components/wf";
import { useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { STAY_BANDS } from "@/components/ward-management/ward-admissions";
import { BED_MAP_LABELS, type BedMap, type BedMapKind } from "./statistics-bed-map";
import base from "./statistics-bed-map.module.css";
import legend from "./statistics-ward-phone-beds.module.css";
import styles from "./statistics-ward-compact.module.css";

/** Which of the roster's own stay bands a whole-day stay falls in (the rule `stayBand` uses). */
export function bandIndexOf(days: number): number {
  const index = STAY_BANDS.findIndex((band) => band.upToDays === null || days < band.upToDays);
  return index === -1 ? STAY_BANDS.length - 1 : index;
}

/**
 * Final round (31 Oct 2026): the legend of a ward desk's phone grid, the same five
 * entries in the same order. A bed held for someone on leave shares the occupied fill and count.
 */
export const BED_LEGEND: { kinds: BedMapKind[]; label: string }[] = [
  { kinds: ["occupied", "leave"], label: BED_MAP_LABELS.occupied },
  { kinds: ["pulled"], label: "Pulled" },
  { kinds: ["closed"], label: BED_MAP_LABELS.closed },
  { kinds: ["prep"], label: "Making ready" },
  { kinds: ["ready"], label: BED_MAP_LABELS.ready },
];

/**
 * The grid's columns, as the phone grid: ten at most, and where the beds divide evenly by 5 to 10,
 * that divisor, so no bed sits alone on a row (20 beds read 10 by 2, 24 read 8 by 3).
 */
export function bedColumns(count: number): number {
  if (count <= 10) return Math.max(count, 1);
  for (let cols = 10; cols >= 5; cols -= 1) if (count % cols === 0) return cols;
  return 10;
}

/**
 * One ward's beds as small tiles in an even grid (final round, 31 Oct 2026: 20 beds read
 * 10 by 2, not 9, 9 and 2). Each state has its own fill, the phone grid's (`statistics-ward-phone-beds.module.css`),
 * and the legend under the grid uses the same swatches, so the laptop and phone maps read alike. A bed
 * someone is in shows the stay in days; on leave says Leave. The cells come straight from the app's
 * `bedMapCells`, so the tiles still add up to the ward's beds.
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
      <ol
        className={styles.bedGrid}
        style={{ "--bed-cols": bedColumns(cells.length) } as CSSProperties}
        aria-label={`${wardName} beds, one item per bed`}
      >
        {cells.map((entry, index) => (
          <li
            key={index}
            className={styles.bedTile}
            title={titleOf(entry)}
            data-bed-kind={entry.kind}
            data-admission-id={entry.admissionId ?? undefined}
          >
            <SrOnly>{titleOf(entry)}</SrOnly>
            {entry.stayDays !== null ? (
              <span className={styles.bedDays} aria-hidden="true">
                {entry.stayDays}d
              </span>
            ) : entry.kind === "leave" ? (
              <span className={styles.bedWord} aria-hidden="true">
                Leave
              </span>
            ) : null}
            {entry.blocked ? (
              <span className={styles.bedBlocked} aria-hidden="true">
                <StatusGlyph tone="warning" size={9} />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <div className={styles.bedFoot}>
        <ul className={legend.legend} aria-hidden="true">
          {BED_LEGEND.map((item) => (
            <li key={item.label}>
              <i className={legend.swatch} data-kind={item.kinds[0]} />
              {item.label}
              <b>{item.kinds.reduce((sum, kind) => sum + map.counts[kind], 0)}</b>
            </li>
          ))}
        </ul>
        <p className={base.note}>
          Grouped by state. Bed numbers are not recorded.
          {map.unplacedRecords > 0
            ? ` ${unplaced} recorded ${unplaced === 1 ? "admission is" : "admissions are"} not shown because the ward's bed count has no bed for ${unplaced === 1 ? "it" : "them"}.`
            : ""}
        </p>
      </div>
    </div>
  );
}

/** The four stay shades, lightest to darkest, with the roster's own band words, for the phone strip. */
export function StayKey() {
  return (
    <ul className={styles.stayKey} aria-hidden="true">
      <li className={styles.stayKeyLabel}>Stay</li>
      {STAY_BANDS.map((band, index) => (
        <li key={band.id} className={styles.stayKeyItem}>
          <span className={styles.staySwatch} data-stay-band={index} />
          {band.label}
        </li>
      ))}
    </ul>
  );
}
