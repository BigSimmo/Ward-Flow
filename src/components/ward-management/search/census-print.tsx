"use client";

import type { ReactNode } from "react";
import { StatusGlyph, SrOnly, cx, tableClasses } from "@/components/wf";
import type { CensusRow } from "./patient-census";
import type { CensusSection } from "./patient-states";
import styles from "./census.module.css";

/** The census's six columns, shared by the screen table and the printed groups. */
export const CENSUS_COLS = 6;

export function TierPill({ tier }: { tier: CensusRow["tier"] }) {
  if (tier === null) {
    return (
      <span className={styles.noTier}>
        <span className="sr-only">No tier</span>
        <span aria-hidden="true">–</span>
      </span>
    );
  }
  return (
    <span className={cx(styles.tier, tier === 1 && styles.tier1)} title={`Tier ${tier}`}>
      <span className="sr-only">Tier {tier}</span>
      <span aria-hidden="true">T{tier}</span>
    </span>
  );
}

export function CensusColumns() {
  return (
    <colgroup>
      <col className={styles.colTier} />
      <col className={styles.colWho} />
      <col className={styles.colWhere} />
      <col className={styles.colNext} />
      <col className={styles.colLegal} />
      <col className={styles.colTime} />
    </colgroup>
  );
}

export function CensusHeadRow() {
  return (
    <tr>
      <th scope="col">Tier</th>
      <th scope="col">Patient</th>
      {/* Redesign: one word, so the header stays on one line like the others. Table polish
          (9 Nov 2026): the cell also says where the person is heading. */}
      <th scope="col" aria-label="Where now">
        Where
      </th>
      <th scope="col">Next step</th>
      <th scope="col">Legal</th>
      <th scope="col" className={styles.num}>
        Time
      </th>
    </tr>
  );
}

/**
 * Printed census (18 Nov 2026): one table per group, with the group name in its head, so a group
 * that runs onto the next page carries its name there as "(continued)" above the repeated column
 * heads. The heading before each table covers that line on its first page (ward-flow-print.css).
 */
export function CensusPrintGroups({
  sections,
  renderRow,
}: {
  sections: readonly CensusSection[];
  renderRow: (row: CensusRow) => ReactNode;
}) {
  return sections.map(({ key, label, rows }) => (
    <div key={key} data-census-print-group={key}>
      <p data-census-print-heading>
        {label} · {rows.length}
      </p>
      <table className={cx(tableClasses.table, styles.censusTable)} aria-label={label}>
        <CensusColumns />
        <thead>
          <tr data-census-print-continued aria-hidden="true">
            <th colSpan={CENSUS_COLS} scope="colgroup">
              {label} (continued)
            </th>
          </tr>
          <CensusHeadRow />
        </thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div>
  ));
}

/**
 * The title line of a printed Patients sheet: its name on the left, the print time on the right
 * (ward-flow-print.css). A div, not a header: the print styles drop every header element as page
 * chrome. The whole list and the short sheet share it (19 Nov 2026 audit: the whole list had none).
 */
export function CensusPrintTitle({ id, title, printedAt }: { id: string; title: string; printedAt?: string }) {
  return (
    <div data-census-print-title>
      <h2 id={id}>{title}</h2>
      {printedAt ? <p>Printed {printedAt}</p> : null}
    </div>
  );
}

/** The facts of one cell on one line, a dot between them. */
const joined = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(" · ");

/**
 * One compact line per person on the ED and placement sheet (option A, approved 18 Nov 2026): the
 * sub-facts follow a dot, the UMRN stays, age and sex stay on screen, and the time is one line.
 */
function ShortPrintRow({ row }: { row: CensusRow }) {
  return (
    <tr data-census-short-row>
      <td>
        <TierPill tier={row.tier} />
      </td>
      <td>
        <b>{row.name}</b> <span className={styles.mono}>{row.umrn}</span>
        {row.confidential ? <span className={styles.restricted}>Restricted</span> : null}
      </td>
      <td>
        {row.group === "ask" ? (
          joined(row.where, row.whereSub)
        ) : (
          <>
            {row.where}
            <span aria-hidden="true"> → </span>
            <SrOnly>, heading to </SrOnly>
            {row.to}
          </>
        )}
      </td>
      <td>{joined(row.next, row.nextWho)}</td>
      {/* "Voluntary · No form" says nothing the first word does not; a form's due time stays. */}
      <td>{joined(row.legal, row.legalSub === "No form" ? null : row.legalSub)}</td>
      <td className={styles.num} data-census-short-time>
        {row.longWait ? <StatusGlyph tone="warning" size={9} /> : null}
        {row.timeText || "Not recorded"}
      </td>
    </tr>
  );
}

/**
 * The Patients short sheet (option A, approved 18 Nov 2026): only the people in ED and in placement,
 * from any tab, in the census's own group order, under one title with the print time. Drawn only
 * while that print is under way; `data-wf-print-doc` prints it alone (ward-flow-print.css).
 */
export function EdPlacementPrintSheet({
  sections,
  printedAt,
}: {
  sections: readonly CensusSection[];
  printedAt: string;
}) {
  return (
    <section
      data-wf-print-doc="ed-placement"
      data-testid="ward-patient-search-ed-placement-print"
      aria-labelledby="ward-ed-placement-print-title"
    >
      <CensusPrintTitle id="ward-ed-placement-print-title" title="ED and placement" printedAt={printedAt} />
      <CensusPrintGroups sections={sections} renderRow={(row) => <ShortPrintRow key={row.key} row={row} />} />
      <p data-census-short-foot>BedChart prototype · Synthetic data only</p>
    </section>
  );
}
