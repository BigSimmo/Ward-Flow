"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";

import { Button } from "@/components/wf";

import { WardPrintFooter } from "@/components/ward-management/shell/ward-access";
import { asAtStamp } from "@/components/ward-management/board/ward-daily-sheet";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
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
 * THE MORNING BED-MEETING SHEET, printed on A4 from Capacity's Bed meeting sheet dialog
 * (`capacity-meeting-sheet-dialog.tsx`, which shows the same figures on screen).
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
      and {count} more {noun}
    </p>
  );
}

/** "Armadale Hospital Emergency Department" reads "Armadale Hospital ED" on the sheet. */
function shortDepartment(name: string): string {
  return name.replace(/ Emergency Department$/, " ED");
}

/** One open action from the agenda, already in words, for the sheet's own section. */
type BedMeetingSheetAction = {
  id: string;
  name: string;
  action: string;
  owner: string;
  due: string;
  overdue: boolean;
};

function BedMeetingSheetView({
  sheet,
  now,
  actions,
}: {
  sheet: BedMeetingSheet;
  now: Instant;
  /** The agenda's open actions. Left out (Capacity), the sheet has no actions section. */
  actions?: readonly BedMeetingSheetAction[];
}) {
  const flow = useOptionalWardFlowSelect("dayZero");
  const stamp = asAtStamp(now, flow?.dayZero);
  const { capacity, discharges, ed, delays, waitingLongest, stuckReferrals } = sheet;
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
      <p className={styles.disclosure}>Synthetic prototype · {stamp.dayNote}. Not approved for clinical use.</p>

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
              <dt>Pulled</dt>
              <dd>
                <Count value={capacity.pulled} />
              </dd>
            </div>
            <div>
              <dt>Closed</dt>
              <dd>
                <Count value={capacity.closed} />
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
            <p className={styles.note}>{discharges.beyondToday} more after tomorrow, not counted.</p>
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
                {/* B1 (Josh, 3 Nov 2026): one line per ED, short name, the two figures in columns. */}
                <li className={styles.tableHead} aria-hidden="true">
                  <span>Emergency department</span>
                  <span>Waiting</span>
                  <span>Longest</span>
                </li>
                {ed.departments.map((row) => (
                  <li key={row.id} className={styles.tableRow}>
                    <span className={styles.rowLead}>{shortDepartment(row.department)}</span>
                    <span className={styles.cell}>{row.waiting}</span>
                    <span className={styles.cell}>{splitDuration(row.longestWaitMinutes)}</span>
                  </li>
                ))}
              </ul>
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
                <li className={styles.tableHead} aria-hidden="true">
                  <span>Cause</span>
                  <span>People</span>
                  <span>Longest</span>
                </li>
                {delays.groups.map((group) => (
                  <li key={group.cause} className={styles.tableRow}>
                    <span className={styles.rowLead}>{group.title}</span>
                    <span className={styles.cell}>{group.count}</span>
                    <span className={styles.cell}>{splitDuration(group.longestWaitMinutes)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Polish (Josh, 3 Nov 2026): one people list, not one under each table. Each person shows
            once, with where they wait and what holds them, in the same columns as the tables. */}
        {waitingLongest.people.length > 0 && (
          <section className={styles.section} aria-labelledby="bed-meeting-waiting" data-testid="bed-meeting-waiting">
            <h3 id="bed-meeting-waiting" className={styles.sectionTitle}>
              Waiting longest
            </h3>
            <ol className={styles.list}>
              {waitingLongest.people.map((person) => (
                <li key={person.id} className={styles.personRow}>
                  <span className={styles.rowLead}>{person.name}</span>
                  <span className={styles.rowNote}>
                    {person.department ? <span>{shortDepartment(person.department)}</span> : null}
                    {person.cause ? <span className={styles.rowCause}>{person.cause}</span> : null}
                  </span>
                  <span className={styles.cell}>{splitDuration(person.waitMinutes)}</span>
                </li>
              ))}
            </ol>
            <More count={waitingLongest.morePeople} noun="people" />
          </section>
        )}

        {stuckReferrals !== undefined && (
          <section
            className={styles.section}
            aria-labelledby="bed-meeting-stuck"
            data-testid="bed-meeting-stuck-referrals"
          >
            <h3 id="bed-meeting-stuck" className={styles.sectionTitle}>
              Referrals stuck: no reply
            </h3>
            {stuckReferrals.places.length === 0 ? (
              <p className={styles.empty}>
                No referral has waited longer than {splitDuration(stuckReferrals.limitMinutes)} for a reply.
              </p>
            ) : (
              <ul className={styles.list}>
                {stuckReferrals.places.map((row) => (
                  <li key={row.place} className={styles.row}>
                    <span className={styles.rowLead}>{row.place}</span>
                    <span className={styles.rowNote}>
                      {row.referrals} {row.referrals === 1 ? "referral" : "referrals"} · longest{" "}
                      {splitDuration(row.longestMinutes)} with no reply
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <More count={stuckReferrals.morePlaces} noun="wards or services" />
            <p className={styles.note}>
              No reply within {splitDuration(stuckReferrals.limitMinutes)}, the limit set in Settings.
            </p>
          </section>
        )}
        {actions !== undefined && (
          <section className={styles.section} aria-labelledby="bed-meeting-actions" data-testid="bed-meeting-actions">
            <h3 id="bed-meeting-actions" className={styles.sectionTitle}>
              Actions agreed at earlier meetings
            </h3>
            {actions.length === 0 ? (
              <p className={styles.empty}>No actions waiting.</p>
            ) : (
              <ul className={styles.list}>
                {actions.map((row) => (
                  <li key={row.id} className={styles.row}>
                    <span className={styles.rowLead}>{row.name}</span>
                    <span className={row.overdue ? styles.tagStrong : styles.tag}>
                      {row.overdue ? "Overdue" : "Open"}
                    </span>
                    <span className={styles.rowNote}>
                      {row.action} · {row.owner} · {row.due}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <p className={styles.footer}>Legal time limits are not checked.</p>
      {flow !== null ? <WardPrintFooter /> : null}
    </article>
  );
}

/**
 * The printed copy of the sheet. Capacity's Bed meeting sheet dialog mounts this while it is open:
 * it marks the page so that printing, by the dialog's Print button or the browser's own shortcut,
 * sends this A4 sheet alone, not the screen or the dialog. On screen it is hidden (`screenHidden`).
 */
export function BedMeetingSheetPrintCopy({
  sheet,
  now,
  screenHidden,
}: {
  sheet: BedMeetingSheet;
  now: Instant;
  /** A class that hides the copy on screen, from the page that mounts it. */
  screenHidden: string;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(BED_MEETING_PRINTING_CLASS);
    return () => root.classList.remove(BED_MEETING_PRINTING_CLASS);
  }, []);
  // Mounted only while the dialog is open, which happens in the browser, never on the server.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`${styles.portal} ${screenHidden}`} data-testid="bed-meeting-sheet-print-copy" aria-hidden="true">
      <div className={styles.dialog}>
        <BedMeetingSheetView sheet={sheet} now={now} />
      </div>
    </div>,
    document.body,
  );
}

/**
 * A button and the dialog it opens, for pages that print the sheet without Capacity's dialog (the
 * bed meeting Agenda). `buildSheet` is called only while the dialog is
 * open, so the sheet always reads the same `now` as the screen at the moment it is shown.
 */
export function BedMeetingSheetLauncher({
  buildSheet,
  now,
  buttonClassName,
  hidden = false,
  icon,
  actions,
}: {
  buildSheet: () => BedMeetingSheet;
  /** The agenda's open actions, printed in their own section. */
  actions?: readonly BedMeetingSheetAction[];
  now: Instant;
  buttonClassName?: string;
  /** Hide only the launcher so an open sheet survives responsive print transitions. */
  hidden?: boolean;
  /** An optional leading icon (phone shows a printer). */
  icon?: ReactNode;
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
        className={`${buttonClassName ?? styles.openButton}${hidden ? ` ${styles.launcherHidden}` : ""}`}
        hidden={hidden}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-testid={hidden ? undefined : "bed-meeting-sheet-open"}
      >
        {icon}
        Bed meeting sheet
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
              {/* B1 (Josh, 3 Nov 2026): a pinned head with the kit's buttons, so Print stays in reach. */}
              <div className={styles.toolbar} data-print-hide>
                <span className={styles.toolbarTitle}>Bed meeting sheet</span>
                <Button
                  variant="pri"
                  size="sm"
                  icon={Printer}
                  onClick={() => window.print()}
                  data-testid="bed-meeting-sheet-print"
                >
                  Print sheet
                </Button>
                <Button variant="sec" size="sm" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
              <BedMeetingSheetView sheet={buildSheet()} now={now} {...(actions ? { actions } : {})} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
