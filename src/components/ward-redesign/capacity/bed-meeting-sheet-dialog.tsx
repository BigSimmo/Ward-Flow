"use client";

import { Dialog, durMinutes } from "@/components/wf";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import type { BedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";

import { Kicker } from "../parts/how-worked-out";
import styles from "./capacity-redesign.module.css";

/**
 * The morning bed meeting sheet: four figures, then the three lists the meeting goes through.
 * The old sheet was one long column; this is two, so it fits one printed page and one screen.
 */
export function BedMeetingSheetDialog({
  open,
  onClose,
  sheet,
  now,
}: {
  open: boolean;
  onClose: () => void;
  sheet: BedMeetingSheet;
  now: number;
}) {
  const { capacity, discharges, ed, delays } = sheet;
  const figures = [
    { label: "Ready now", value: capacity.ready, sub: `of ${capacity.beds} · ${capacity.lockedReady} locked` },
    { label: "Waiting in ED", value: ed.waiting, sub: `${ed.overLongWait} over 24 hours · ${ed.detained} detained` },
    {
      label: "Due out today",
      value: discharges.confirmed + discharges.expected + discharges.heldUp,
      sub: `${discharges.heldUp} held up`,
    },
    { label: "Pulled", value: capacity.pulled, sub: `${capacity.closed} closed` },
  ];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Bed meeting sheet · ${sheet.service ?? "all services"}`}
      description={`As at ${formatInstant(now)}. Synthetic, not a record of any real day.`}
      size="lg"
      secondary={[{ label: "Close", onAction: onClose }]}
      primary={{ label: "Print sheet", onAction: () => window.print() }}
      data-testid="redesign-bed-meeting-sheet"
    >
      <dl className={styles.sheetFigures}>
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt className={styles.mutedXs}>{figure.label}</dt>
            <dd>
              <b className={styles.sheetFigure}>{figure.value}</b>
              <span className={styles.mutedXs}>{figure.sub}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className={styles.sheetCols}>
        <section aria-labelledby="sheet-ed">
          <h3 id="sheet-ed" className={styles.sheetHead}>
            <Kicker>Waiting in emergency departments</Kicker>
          </h3>
          <ul className={styles.sheetList}>
            {ed.departments.map((row) => (
              <li key={row.id}>
                <span>
                  <SpelledCodes text={row.department} />
                </span>
                <b>{row.waiting}</b>
                <span className={styles.mono}>{durMinutes(row.longestWaitMinutes)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="sheet-held">
          <h3 id="sheet-held" className={styles.sheetHead}>
            <Kicker>Releases today</Kicker>
          </h3>
          <ul className={styles.sheetList}>
            {discharges.rows.map((row) => (
              <li key={row.id}>
                <span className={styles.strong}>
                  <SpelledCodes text={row.ward} />
                </span>
                <span className={row.status === "Held up" ? styles.warnInk : undefined}>
                  {row.status}
                  {row.note ? `, ${row.note}` : ""}
                </span>
              </li>
            ))}
            {discharges.moreRows > 0 ? <li className={styles.mutedXs}>And {discharges.moreRows} more</li> : null}
          </ul>
          <h3 className={styles.sheetHead}>
            <Kicker>Top delays</Kicker>
          </h3>
          <ul className={styles.sheetList}>
            {delays.groups.map((group) => (
              <li key={group.cause}>
                <span>{group.title}</span>
                <b>{group.count}</b>
                <span className={styles.mono}>{durMinutes(group.longestWaitMinutes)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className={styles.mutedXs}>The printed copy carries this preparation time.</p>
    </Dialog>
  );
}
