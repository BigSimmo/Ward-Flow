"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { asAtStamp } from "@/components/ward-management/board/ward-daily-sheet";
import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import {
  LONG_WAIT_MINUTES,
  LONG_WAIT_TEXT,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";

import { countCellText } from "./capacity-derivations";
import type { BedMeetingSheet } from "./bed-meeting-derivations";
import styles from "./bed-meeting-sheet.module.css";

/**
 * THE MORNING BED-MEETING SHEET — opened from Capacity, previewed in a dialog, printed on one page.
 *
 * Every figure arrives already computed by `bedMeetingSheet` (`bed-meeting-derivations.ts`); this
 * file only lays it out. While the dialog is open the page is marked so that printing — by the
 * Print button or the browser's own shortcut — sends the sheet alone, not the screen behind it.
 */

/** Class put on `<html>` while the sheet is open; the print rules in the module key off it. */
export const BED_MEETING_PRINTING_CLASS = "ward-bed-meeting-printing";

function Count({ value }: { value: number }) {
  return <strong className={styles.figure}>{countCellText(value)}</strong>;
}

function More({ count, noun }: { count: number; noun: string }) {
  if (count === 0) return null;
  return (
    <p className={styles.more}>
      and {count} more {noun} — see the screen for the full list
    </p>
  );
}

export function BedMeetingSheetView({ sheet, now }: { sheet: BedMeetingSheet; now: Instant }) {
  const stamp = asAtStamp(now);
  const { capacity, discharges, ed, delays } = sheet;
  const scope = sheet.service === null ? "All services" : sheet.service;

  return (
    <article className={styles.sheet} data-testid="bed-meeting-sheet" aria-labelledby="bed-meeting-sheet-title">
      <div className={styles.titleRow}>
        <h2 id="bed-meeting-sheet-title" className={styles.title}>
          Morning bed meeting · {scope}
        </h2>
        <p className={styles.stamp} data-testid="bed-meeting-sheet-as-at">
          {stamp.time === null ? "As at — the moment shown is not recorded." : `As at ${stamp.time}`}
        </p>
      </div>
      <p className={styles.disclosure}>Synthetic prototype · {stamp.dayNote}. Not a medical device.</p>

      <div className={styles.grid}>
        <section className={styles.section} aria-labelledby="bed-meeting-capacity" data-testid="bed-meeting-capacity">
          <h3 id="bed-meeting-capacity" className={styles.sectionTitle}>
            Today&apos;s capacity
          </h3>
          <dl className={styles.facts}>
            <div>
              <dt>Beds ready now</dt>
              <dd>
                <Count value={capacity.ready} /> of {capacity.beds} in {capacity.wards} wards
              </dd>
            </div>
            <div>
              <dt>Locked beds ready</dt>
              <dd>
                <Count value={capacity.lockedReady} />
              </dd>
            </div>
            <div>
              <dt>Occupied</dt>
              <dd>
                <Count value={capacity.occupied} />
              </dd>
            </div>
            <div>
              <dt>Held</dt>
              <dd>
                <Count value={capacity.held} />
              </dd>
            </div>
            <div>
              <dt>Being made ready</dt>
              <dd>
                {capacity.pendingPreparation === undefined ? (
                  "Not tracked here"
                ) : (
                  <Count value={capacity.pendingPreparation} />
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section
          className={styles.section}
          aria-labelledby="bed-meeting-discharges"
          data-testid="bed-meeting-discharges"
        >
          <h3 id="bed-meeting-discharges" className={styles.sectionTitle}>
            Expected discharges, today and tomorrow
          </h3>
          <p className={styles.summary}>
            <Count value={discharges.heldUp} /> held up · <Count value={discharges.confirmed} /> confirmed ·{" "}
            <Count value={discharges.expected} /> expected · <Count value={discharges.dischargedToday} /> discharged
            today
          </p>
          {discharges.rows.length === 0 ? (
            <p className={styles.empty}>No discharges expected today or tomorrow.</p>
          ) : (
            <ul className={styles.list}>
              {discharges.rows.map((row) => (
                <li key={row.id} className={styles.row}>
                  <span className={styles.rowLead}>{row.ward}</span>
                  <span className={row.status === "Held up" ? styles.tagStrong : styles.tag}>{row.status}</span>
                  {row.note !== null && <span className={styles.rowNote}>{row.note}</span>}
                </li>
              ))}
            </ul>
          )}
          <More count={discharges.moreRows} noun="discharges" />
          {discharges.beyondToday > 0 && (
            <p className={styles.note}>
              {discharges.beyondToday} more expected after tomorrow, left out of these figures.
            </p>
          )}
        </section>

        <section className={styles.section} aria-labelledby="bed-meeting-ed" data-testid="bed-meeting-ed">
          <h3 id="bed-meeting-ed" className={styles.sectionTitle}>
            Waiting in emergency departments
          </h3>
          <p className={styles.summary}>
            <Count value={ed.waiting} /> waiting · <Count value={ed.detained} /> detained under the Act ·{" "}
            <Count value={ed.overLongWait} /> waiting {LONG_WAIT_TEXT}
          </p>
          {ed.departments.length === 0 ? (
            <p className={styles.empty}>Nobody is waiting in an emergency department.</p>
          ) : (
            <>
              <ul className={styles.list}>
                {ed.departments.map((row) => (
                  <li key={row.id} className={styles.row}>
                    <span className={styles.rowLead}>{row.department}</span>
                    <span className={styles.rowNote}>
                      {row.waiting} waiting · longest {splitDuration(row.longestWaitMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
              <h4 className={styles.subTitle}>Longest waits</h4>
              <ol className={styles.list}>
                {ed.longestWaits.map((person) => (
                  <li key={person.id} className={styles.row}>
                    <span className={styles.rowLead}>{person.name}</span>
                    <span className={styles.rowNote}>
                      {person.department} · {splitDuration(person.waitMinutes)}
                    </span>
                  </li>
                ))}
              </ol>
              <More count={ed.morePeople} noun="people" />
            </>
          )}
          <p className={styles.note}>
            The {LONG_WAIT_MINUTES / 60}-hour mark is {OPERATIONAL_DEFAULT_LABEL}.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="bed-meeting-delays" data-testid="bed-meeting-delays">
          <h3 id="bed-meeting-delays" className={styles.sectionTitle}>
            Top delays
          </h3>
          <p className={styles.summary}>
            <Count value={delays.total} /> people held up across {delays.groups.length}{" "}
            {delays.groups.length === 1 ? "cause" : "causes"}
          </p>
          {delays.groups.length === 0 ? (
            <p className={styles.empty}>Nobody is recorded as held up.</p>
          ) : (
            <>
              <ul className={styles.list}>
                {delays.groups.map((group) => (
                  <li key={group.cause} className={styles.row}>
                    <span className={styles.rowLead}>{group.title}</span>
                    <span className={styles.rowNote}>
                      {group.count} · longest {splitDuration(group.longestWaitMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
              <h4 className={styles.subTitle}>Waiting longest</h4>
              <ol className={styles.list}>
                {delays.longestWaits.map((person) => (
                  <li key={person.id} className={styles.row}>
                    <span className={styles.rowLead}>{person.name}</span>
                    <span className={styles.rowNote}>
                      {person.cause} · {splitDuration(person.waitMinutes)}
                    </span>
                  </li>
                ))}
              </ol>
              <More count={delays.morePeople} noun="people" />
            </>
          )}
        </section>
      </div>

      <p className={styles.footer}>
        Figures come from the Capacity, Discharges, ED and Delays screens at the moment above. Legal time limits are not
        checked in this prototype.
      </p>
    </article>
  );
}

/**
 * The button on Capacity and the dialog it opens. `buildSheet` is called only while the dialog is
 * open, so the sheet always reads the same `now` as the screen at the moment it is shown.
 */
export function BedMeetingSheetLauncher({
  buildSheet,
  now,
  buttonClassName,
}: {
  buildSheet: () => BedMeetingSheet;
  now: Instant;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useWardModalFocus(open, panel, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add(BED_MEETING_PRINTING_CLASS);
    return () => root.classList.remove(BED_MEETING_PRINTING_CLASS);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`${styles.openButton}${buttonClassName ? ` ${buttonClassName}` : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-testid="bed-meeting-sheet-open"
      >
        Bed-meeting sheet
      </button>
      {open &&
        createPortal(
          <div className={styles.portal} data-testid="bed-meeting-sheet-portal">
            <div className={styles.backdrop} aria-hidden="true" onClick={() => setOpen(false)} />
            <div
              ref={panel}
              className={styles.dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="bed-meeting-sheet-title"
              tabIndex={-1}
            >
              <div className={styles.toolbar} data-print-hide>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => window.print()}
                  data-testid="bed-meeting-sheet-print"
                >
                  Print sheet
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
              <BedMeetingSheetView sheet={buildSheet()} now={now} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
