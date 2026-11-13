"use client";

import { useEffect, useRef } from "react";

import { Badge, Dialog, durMinutes } from "@/components/wf";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { tvServiceParam } from "@/components/ward-management/bed-meeting/tv-derivations";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import {
  calendarDateOf,
  formatInstant,
  formatInstantWithDay,
  perthDateText,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { useOptionalRouter } from "@/components/ward-management/ward/ward-screen-helpers";
import type { BedMeetingSheet } from "./bed-meeting-derivations";
import { BedMeetingSheetPrintCopy } from "./bed-meeting-sheet";

import { Kicker } from "./capacity-how-worked-out";
import { shortNeed } from "./capacity-mismatch-band";
import styles from "./capacity-page.module.css";
import sheetStyles from "./capacity-meeting-sheet.module.css";

/** The scrolling body's spoken name (A5-11): it is focusable, so a keyboard can scroll it. */
export const BED_MEETING_SHEET_BODY_LABEL = "Bed meeting sheet, scroll with the arrow keys";

/**
 * The morning bed meeting sheet: four figures, then the lists the meeting goes through. The old
 * sheet was one long column; this is two, so it fits one printed page and one screen.
 *
 * Wave 4 (C8, notes item 8, D-191): every figure carries its window and copies Capacity's
 * ("Ready · now", "Short · now", "Discharges · today", "Waiting in ED · now"); a "Held up · by
 * tomorrow" list by ward, with no patient names; a neutral "Synthetic data" tag; a focusable,
 * named body; and Close, Open on TV and Print sheet in the footer (one filled).
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
  const { capacity, short, discharges, ed, delays } = sheet;
  const flow = useOptionalWardFlowSelect("dayZero");
  const dayZero = flow?.dayZero;
  const canOpen = useCanOpenHref();
  const tvOn = useWardFeatureFlag("bed-meeting-tv");
  const router = useOptionalRouter();
  const tvHref = bedMeetingTvHref({ service: tvServiceParam(sheet.service) });
  const showTv = tvOn && canOpen(tvHref);

  // A due date said once, as Capacity's held-up rows say it ("9 Nov"); a bare time without a day.
  const dueText = (dueAt: Instant) =>
    dayZero
      ? perthDateText(calendarDateOf(dueAt, dayZero), { day: "numeric", month: "short" })
      : formatInstantWithDay(dueAt, now);
  const asAtDay = dayZero
    ? `, ${perthDateText(calendarDateOf(now, dayZero), { weekday: "long", day: "numeric", month: "long" })}`
    : "";

  const shortWord = short.gap > 0 ? "Spare" : "Short";
  const spare = short.spare.map((kind) => `${shortNeed(kind.need).toLowerCase()} ${kind.count} spare`);
  const figures = [
    {
      id: "ready",
      label: "Ready",
      window: "now",
      value: capacity.ready,
      sub: [
        `of ${capacity.beds}`,
        `${capacity.pulled} pulled`,
        ...(capacity.pendingPreparation ? [`${capacity.pendingPreparation} being made ready`] : []),
      ].join(" · "),
    },
    {
      id: "short",
      label: shortWord,
      window: "now",
      value: Math.abs(short.gap),
      // Review P4-5: the bed gap is counted across the network (bed-meeting-derivations), so a
      // one-service sheet says so, as Capacity's own network figures do.
      sub: [...(sheet.service === null ? [] : ["Network-wide"]), `${short.waiting} need a bed`, ...spare].join(" · "),
    },
    {
      id: "discharges",
      label: "Discharges",
      window: "today",
      value: discharges.freeingToday,
      // The held-up count is the "by tomorrow" span (overdue, today and tomorrow), said, so it never
      // reads against the any-date count on Discharges (A16-25, F-25).
      sub: `${discharges.heldUp} held up · by tomorrow`,
    },
    {
      id: "ed",
      label: "Waiting in ED",
      window: "now",
      value: ed.waiting,
      sub: `${ed.overLongWait} waiting past 24 hours · ${ed.detained} detained`,
    },
  ];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Bed meeting sheet · ${sheet.service ?? "all services"}`}
      description={
        // PR E swap: SyntheticMark in the dialog header (shared spec 7); WindowWord for the figure windows.
        <span className={sheetStyles.descRow}>
          <span>
            As at {formatInstant(now)}
            {asAtDay}. Same figures as Capacity and the TV view.
          </span>
          <Badge size="sm" className={sheetStyles.synthetic} title="Synthetic data, not a medical record">
            Synthetic data
          </Badge>
        </span>
      }
      size="lg"
      secondary={[
        { label: "Close", onAction: onClose },
        ...(showTv
          ? [
              {
                label: "Open on TV",
                onAction: () => (router ? router.push(tvHref) : window.location.assign(tvHref)),
              },
            ]
          : []),
      ]}
      primary={{ label: "Print sheet", onAction: () => window.print() }}
      data-testid="bed-meeting-sheet-dialog"
    >
      <FocusableBody />
      <BedMeetingSheetPrintCopy sheet={sheet} now={now} screenHidden={styles.screenHidden} />
      <dl className={styles.sheetFigures}>
        {figures.map((figure) => (
          <div key={figure.id} data-testid={`bed-meeting-sheet-figure-${figure.id}`}>
            <dt className={styles.mutedXs}>
              {figure.label}
              <span className={sheetStyles.win}> · {figure.window}</span>
            </dt>
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
            <Kicker>Waiting in EDs · now</Kicker>
          </h3>
          <ul className={styles.sheetList}>
            {ed.departments.map((row) => (
              <li key={row.id}>
                <span className={sheetStyles.place}>
                  <SpelledCodes text={row.department} />
                </span>
                <b>{row.waiting}</b>
                <span className={styles.mono}>{durMinutes(row.longestWaitMinutes)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="sheet-discharges">
          <h3 id="sheet-discharges" className={styles.sheetHead}>
            <Kicker>Discharges · today</Kicker>
          </h3>
          <ul className={styles.sheetList}>
            {discharges.todayRows.map((row) => (
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
            {discharges.moreTodayRows > 0 ? (
              <li className={styles.mutedXs}>And {discharges.moreTodayRows} more</li>
            ) : null}
            {discharges.todayRows.length === 0 ? <li className={styles.mutedXs}>None due today</li> : null}
          </ul>
          <h3 id="sheet-held" className={styles.sheetHead}>
            <Kicker>Held up · by tomorrow</Kicker>
          </h3>
          <ul className={`${styles.sheetList} ${sheetStyles.heldList}`} data-testid="bed-meeting-sheet-held-up">
            {discharges.heldUpRows.map((row) => (
              <li key={row.id}>
                <span className={styles.strong}>
                  <SpelledCodes text={row.ward} />
                </span>
                <span className={sheetStyles.reason}>{row.reason}</span>
                <span className={styles.mono}>{dueText(row.dueAt)}</span>
              </li>
            ))}
            {discharges.moreHeldUpRows > 0 ? (
              <li className={styles.mutedXs}>And {discharges.moreHeldUpRows} more</li>
            ) : null}
            {discharges.heldUpRows.length === 0 ? <li className={styles.mutedXs}>None held up</li> : null}
          </ul>
          <h3 className={styles.sheetHead}>
            <Kicker>Top delays · now</Kicker>
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
    </Dialog>
  );
}

/**
 * A5-11: the dialog's scrolling body joins the tab order with a spoken name, so a keyboard user can
 * reach it and scroll it with the arrow keys. PR E swap: the kit dialog should take a body label.
 */
function FocusableBody() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const body = ref.current?.parentElement;
    if (!body) return;
    body.tabIndex = 0;
    body.setAttribute("role", "region");
    body.setAttribute("aria-label", BED_MEETING_SHEET_BODY_LABEL);
    body.setAttribute("data-sheet-body", "");
  }, []);
  return <span ref={ref} hidden data-testid="bed-meeting-sheet-body-anchor" />;
}
