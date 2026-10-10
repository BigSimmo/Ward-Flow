import { CircleDashed } from "lucide-react";

import { SrOnly, StatusGlyph, cx } from "@/components/wf";
import { daysInBed, stayBand, type Admission } from "@/components/ward-management/ward-admissions";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { BED_STATE_DETAILS, bedStates } from "@/components/ward-management/ward-bed-states";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";

import styles from "./statistics-bed-map.module.css";

export type BedMapKind = "occupied" | "leave" | "pulled" | "ready" | "prep" | "closed";

export type BedMapCell = {
  kind: BedMapKind;
  /** The synthetic admission number in this bed, when a record can be matched to it. Never a name. */
  admissionId: string | null;
  /** Whole days since arrival, for a bed someone is in. */
  stayDays: number | null;
  /** Over three months, the roster's own long-stay band. */
  longStay: boolean;
  /** The admission carries a discharge blocker. */
  blocked: boolean;
};

export type BedMap = {
  cells: BedMapCell[];
  counts: Record<BedMapKind, number>;
  /** Admissions recorded on the ward that no cell could hold (the ward's bed observation disagrees). */
  unplacedRecords: number;
};

export const BED_MAP_ORDER: readonly BedMapKind[] = ["occupied", "leave", "pulled", "ready", "prep", "closed"];

export const BED_MAP_LABELS: Record<BedMapKind, string> = {
  occupied: "Occupied",
  leave: "On leave",
  pulled: "Pulled, not arrived",
  ready: "Ready",
  prep: "Being made ready",
  closed: "Closed",
};

/** The short word inside a cell with no stay to show. */
const CELL_WORDS: Record<BedMapKind, string> = {
  occupied: "In bed",
  leave: "Leave",
  pulled: "Pulled",
  ready: "Ready",
  prep: "Preparing",
  closed: "Closed",
};

const BED_MAP_DETAILS: Record<BedMapKind, string> = {
  occupied: BED_STATE_DETAILS.occupied,
  leave: "Held for a patient on leave; counted in Occupied",
  pulled: BED_STATE_DETAILS.pulled,
  ready: BED_STATE_DETAILS.ready,
  prep: "Released and still being made ready; no one can be pulled into it yet",
  closed: BED_STATE_DETAILS.closed,
};

/**
 * One cell per bed, from the ward's own bed states (`bedStates`), so the cells always add up to
 * the ward's beds and agree with every other bed figure on the page.
 *
 * ⚠️ **THE MODEL RECORDS A WARD, NOT A NUMBERED BED.** Cells are grouped by state, not placed where a
 * bed physically is, and carry no bed number. Where an admission can be matched to a cell (someone
 * in a bed, on leave, or pulled), its synthetic admission number is attached for the hover title.
 *
 * "Being made ready" sits inside Ready (nothing is subtracted from Ready while a bed is prepared,
 * `ward-bed-states.ts`), or inside Closed when a later observation stopped offering it, so those
 * cells are taken out of the box they sit in rather than added as extra beds.
 */
export function bedMapCells(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: BedRelease[],
  leaveBeds: readonly LeaveBed[],
  now: number,
): BedMap {
  const states = bedStates(unit, admissions, bedReleases, leaveBeds);
  const here = admissions.filter((admission) => admission.unitId === unit.id && admission.state !== "departed");
  const leaveIds = new Set(leaveBeds.filter((bed) => bed.unitId === unit.id).map((bed) => bed.admissionId));
  const byLongestStay = (a: Admission, b: Admission) => (daysInBed(b, now) ?? -1) - (daysInBed(a, now) ?? -1);
  const occupants = here.filter((admission) => admission.state === "occupied");
  const onLeave = occupants.filter((admission) => leaveIds.has(admission.id)).sort(byLongestStay);
  const inBed = occupants.filter((admission) => !leaveIds.has(admission.id)).sort(byLongestStay);
  const pulled = here
    .filter((admission) => admission.state === "pulled")
    .sort((a, b) => (a.pulledAt ?? 0) - (b.pulledAt ?? 0));

  // The same count `bedStates` reports as `beingMadeReady`, read where the ruling says to read it.
  const beingMadeReady = bedsPendingPreparation(unit.id, bedReleases);
  const prepFromReady = Math.min(beingMadeReady, states.ready);
  const prepFromClosed = Math.min(beingMadeReady - prepFromReady, states.closed);
  const counts: Record<BedMapKind, number> = {
    occupied: Math.max(0, states.occupied - states.onLeave),
    leave: states.onLeave,
    pulled: states.pulled,
    ready: states.ready - prepFromReady,
    prep: prepFromReady + prepFromClosed,
    closed: states.closed - prepFromClosed,
  };

  const cell = (kind: BedMapKind, admission: Admission | undefined): BedMapCell => {
    const days = admission && kind !== "pulled" ? daysInBed(admission, now) : null;
    return {
      kind,
      admissionId: admission?.id ?? null,
      stayDays: days,
      longStay: admission !== undefined && kind !== "pulled" && stayBand(admission, now)?.id === "over-3-months",
      blocked: admission?.blockReason != null,
    };
  };

  const pools: Partial<Record<BedMapKind, Admission[]>> = { occupied: inBed, leave: onLeave, pulled };
  let placed = 0;
  const cells: BedMapCell[] = [];
  for (const kind of BED_MAP_ORDER) {
    const pool = pools[kind] ?? [];
    for (let index = 0; index < counts[kind]; index += 1) {
      const admission = pool[index];
      if (admission) placed += 1;
      cells.push(cell(kind, admission));
    }
  }
  return { cells, counts, unplacedRecords: Math.max(0, inBed.length + onLeave.length + pulled.length - placed) };
}

function CellGlyph({ kind }: { kind: BedMapKind }) {
  if (kind === "leave") return <StatusGlyph tone="neutral" size={11} />;
  if (kind === "pulled") return <StatusGlyph tone="info" size={11} />;
  if (kind === "ready") return <StatusGlyph tone="success" size={11} />;
  if (kind === "closed") return <StatusGlyph tone="closed" size={11} />;
  if (kind === "prep") return <CircleDashed size={11} aria-hidden="true" />;
  return null;
}

function cellTitle(entry: BedMapCell): string {
  const parts = [BED_MAP_LABELS[entry.kind]];
  if (entry.admissionId) parts.unshift(entry.admissionId);
  if (entry.stayDays !== null) parts.push(`${entry.stayDays} ${entry.stayDays === 1 ? "day" : "days"}`);
  if (entry.blocked) parts.push("discharge blocked");
  if ((entry.kind === "occupied" || entry.kind === "leave") && !entry.admissionId) parts.push("no admission record");
  return parts.join(" · ");
}

/** The bed map's key: one swatch per state, the same shape and colour as the cells, with counts. */
export function StatisticsBedMapLegend({ counts }: { counts: Record<BedMapKind, number> }) {
  return (
    <ul className={styles.legend} aria-hidden="true">
      {BED_MAP_ORDER.map((kind) => (
        <li key={kind} className={styles.legendItem} title={BED_MAP_DETAILS[kind]}>
          <span className={cx(styles.swatch, styles[kind])}>
            <CellGlyph kind={kind} />
          </span>
          {BED_MAP_LABELS[kind]}
          <b className={styles.legendCount}>{counts[kind]}</b>
        </li>
      ))}
      <li className={styles.legendItem}>
        <StatusGlyph tone="warning" size={9} />
        Discharge blocked
      </li>
    </ul>
  );
}

/**
 * The ward's beds as cells, one per bed: shape and colour carry the state, so it reads without
 * colour. The grid is drawn for the eye and said once in words beside it.
 */
export function StatisticsBedMap({ map, wardName }: { map: BedMap; wardName: string }) {
  const { cells, counts, unplacedRecords } = map;
  const blocked = cells.filter((entry) => entry.blocked).length;
  const said = BED_MAP_ORDER.filter((kind) => counts[kind] > 0)
    .map((kind) => `${counts[kind]} ${BED_MAP_LABELS[kind].toLowerCase()}`)
    .join(", ");
  return (
    <div className={styles.map} data-testid="ward-statistics-bed-map">
      <SrOnly>
        {`${wardName} has ${cells.length} ${cells.length === 1 ? "bed" : "beds"}: ${said || "none recorded"}.`}
        {blocked > 0 ? ` ${blocked} of the people in a bed ${blocked === 1 ? "has" : "have"} a discharge blocker.` : ""}
      </SrOnly>
      <ol className={styles.grid} aria-label={`${wardName} beds, one item per bed`}>
        {cells.map((entry, index) => (
          <li
            key={index}
            className={cx(styles.cell, styles[entry.kind])}
            title={cellTitle(entry)}
            data-bed-kind={entry.kind}
            data-admission-id={entry.admissionId ?? undefined}
          >
            {/* The cell is drawn for the eye; a screen reader hears the same detail as the hover title. */}
            <SrOnly>{cellTitle(entry)}</SrOnly>
            <span className={styles.glyph} aria-hidden="true">
              <CellGlyph kind={entry.kind} />
            </span>
            {entry.stayDays !== null ? (
              <span className={cx(styles.days, entry.longStay && styles.long)} aria-hidden="true">
                {entry.stayDays}d
              </span>
            ) : (
              <span className={styles.state} aria-hidden="true">
                {CELL_WORDS[entry.kind]}
              </span>
            )}
            {entry.blocked ? (
              <span className={styles.blocked} aria-hidden="true">
                <StatusGlyph tone="warning" size={9} />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <p className={styles.note}>
        Grouped by state. Bed numbers are not recorded; hover a bed for its admission number, or see the admission
        roster.
        {unplacedRecords > 0
          ? ` ${unplacedRecords} recorded ${unplacedRecords === 1 ? "admission is" : "admissions are"} not shown because the ward's bed count has no bed for ${unplacedRecords === 1 ? "it" : "them"}.`
          : ""}
      </p>
    </div>
  );
}
