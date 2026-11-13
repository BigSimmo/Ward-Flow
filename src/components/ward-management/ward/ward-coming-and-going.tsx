"use client";

// Wave 4 (D-191, 13 Nov 2026), Ward home's second part: "Coming and going". It replaces the Ward flow
// panel's three-way switch and the four cards under the page (This shift, Discharges today, Arrivals
// booked, Tomorrow): arrivals, referrals, beds that need a look and today's discharges sit in one list,
// each row naming the person and the bed, with Tomorrow as one foot line. Desk-aware actions: Pull the
// bed is the one filled button; the ward desk also sees Confirm arrival.

import { useState, type ReactNode } from "react";
import { Undo2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHead,
  ShowMoreRow,
  SrOnly,
  StatusGlyph,
  foldHidden,
  foldLimit,
  cx,
} from "@/components/wf";
import type { WardTomorrowOutlook } from "./ward-home-outlook";
import type { ComingRow } from "./ward-coming-and-going-rows";
import styles from "./ward-coming-and-going.module.css";

/** About eight rows, then "Show N more" (design rule). */
const COMING_ROW_LIMIT = 8;

export type ComingAndGoingProps = {
  /** Phone: the card sits in the page between the squares and the round. */
  phone: boolean;
  updated: ReactNode;
  arrivals: ComingRow[];
  /** Review P4-4: accepted people expected on a later day, left off "Arrivals · today" and counted here. */
  laterArrivals?: number;
  backFromLeave: ComingRow[];
  referralsWaiting: number;
  answeredToday: number;
  /** The waiting referrals with their Accept and Decline, drawn by Ward home (test contracts kept). */
  referrals: ReactNode;
  needsALook: { rows: ComingRow[]; heldUp: number; pastDate: number; heldUpPastDate?: number };
  dischargesToday: ComingRow[];
  /** "Bed 07 freed 07:42." for the empty Discharges line. */
  lastFreed?: string;
  outlook: WardTomorrowOutlook | null;
  openReleases: number;
  /** Arrivals: the inline Undo on a row just pulled ("Undo pull · until 10:46"). */
  undoFor?: (movementId: string) => { label: string; run: () => void } | null;
  /** Under a row whose last action the engine refused. */
  refusalFor?: (movementId: string) => ReactNode;
  onPull: (row: ComingRow) => void;
  onConfirmArrival: (row: ComingRow) => void;
  onOpenArrival: (movementId: string) => void;
  onOpenBed: (bedNumber: number) => void;
  onOpenArrivals?: () => void;
  onOpenDischarges?: () => void;
};

function rangeEnd(value: number): string {
  return value < 0 ? `${-value} short` : `${value} free`;
}

/**
 * "Tomorrow 1 short · range 1 short to 2 free · From ward dates" (forecast line, D-191 revision and
 * D-198 words, as Home's beds-gap foot reads): no "likely" in either case.
 */
export function tomorrowLine(outlook: WardTomorrowOutlook): string {
  return `${rangeEnd(outlook.likely)} · range ${rangeEnd(outlook.low)} to ${rangeEnd(outlook.high)} · From ward dates`;
}

// PR E swap: the window word becomes the kit's WindowWord (`wf/window-word`) once PR E lands.
function GroupHead({
  id,
  n,
  title,
  window: windowWord,
  aside,
}: {
  id: string;
  n: number;
  title: string;
  window: string;
  aside?: string;
}) {
  return (
    // tabIndex -1: focus can land here when a row it held leaves the list (review FA-2).
    <h3 className={styles.groupHead} id={id} tabIndex={-1}>
      <b className={styles.n}>{n}</b> {title} <span className={styles.win}>· {windowWord}</span>
      {aside ? (
        <>
          {" "}
          <span className={styles.groupAside}>{aside}</span>
        </>
      ) : null}
    </h3>
  );
}

/**
 * Review FS-2: the group's note adds up to its rows. A held-up bed that is also past its date is
 * said once, inside the held-up figure: "2 held up, 1 of them past date · 2 more past date".
 */
function needsALookNote({
  heldUp,
  pastDate,
  heldUpPastDate = 0,
}: {
  heldUp: number;
  pastDate: number;
  heldUpPastDate?: number;
}): string {
  const held = heldUpPastDate > 0 ? `${heldUp} held up, ${heldUpPastDate} of them past date` : `${heldUp} held up`;
  // Audit G: "more" once part of Past date sits in the held-up figure, so one label never shows two numbers.
  return `${held} · ${pastDate - heldUpPastDate}${heldUpPastDate > 0 ? " more" : ""} past date`;
}

export function WardComingAndGoing(props: ComingAndGoingProps) {
  const { phone, arrivals, backFromLeave, needsALook, dischargesToday } = props;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // One filled button per panel (design rule), desk-aware as the mock-ups draw it: the ward desk's is
  // its first Confirm arrival (main-ward-*: Marrowvale's row), the coordinator's its first Pull the bed.
  // Only the ward desk's rows carry Confirm arrival, so the coordinator's panel is unchanged.
  const filledKey = (
    arrivals.find((row) => row.action === "confirm-arrival" && !row.blocked) ??
    arrivals.find((row) => row.action === "pull" && !row.blocked)
  )?.key;

  function renderRow(row: ComingRow) {
    const undo = row.movementId ? props.undoFor?.(row.movementId) : null;
    const openRow = () => {
      if (row.movementId) props.onOpenArrival(row.movementId);
      else if (row.bedNumber !== undefined) props.onOpenBed(row.bedNumber);
    };
    const opens = row.movementId !== undefined || row.bedNumber !== undefined;
    return (
      <li key={row.key} className={styles.row} data-testid={`ward-coming-row-${row.key}`}>
        <span className={styles.rowGlyph}>
          <StatusGlyph tone={row.tone} size={9} />
        </span>
        <div className={styles.rowMain}>
          <p className={styles.rowTop}>
            {opens ? (
              <button type="button" className={styles.rowName} aria-haspopup="dialog" onClick={openRow}>
                {row.name}
              </button>
            ) : (
              <span className={styles.rowName}>{row.name}</span>
            )}
            {/* Ruling 12 (D-191): the legal tag as recorded. PR E swap: the kit's Badge `tag`. */}
            {row.tag ? (
              <Badge size="sm" className={styles.rowTag}>
                {row.tag}
              </Badge>
            ) : null}
          </p>
          {row.lines.map((line) => (
            <p key={line} className={styles.rowLine}>
              {line}
            </p>
          ))}
          {row.quietLine ? <p className={cx(styles.rowLine, styles.ink3)}>{row.quietLine}</p> : null}
          {undo ? (
            // PR E swap: the kit's RowUndo (`wf/row-undo`) replaces this button once PR E lands.
            <div className={styles.rowSub}>
              <Button variant="ghost" size="sm" className={styles.undo} onClick={undo.run}>
                <Undo2 size={14} strokeWidth={1.75} aria-hidden="true" />
                {undo.label} <SrOnly>for {row.name}</SrOnly>
              </Button>
            </div>
          ) : null}
          {row.movementId ? props.refusalFor?.(row.movementId) : null}
        </div>
        <div className={styles.rowAct}>
          {row.action === "pull" ? (
            <Button
              variant={row.key === filledKey ? "pri" : "sec"}
              size="sm"
              className={styles.pull}
              data-placement-action
              disabledReason={row.blocked}
              reasonDisplay="tooltip"
              onClick={() => props.onPull(row)}
            >
              Pull the bed <SrOnly>{row.name}</SrOnly>
            </Button>
          ) : null}
          {row.action === "pull" ? (
            row.alsoArrive ? (
              <Button variant="sec" size="sm" onClick={() => props.onConfirmArrival(row)}>
                Confirm arrival <SrOnly>{row.name}</SrOnly>
              </Button>
            ) : null
          ) : row.action === "confirm-arrival" ? (
            <Button
              variant={row.key === filledKey ? "pri" : "sec"}
              size="sm"
              disabledReason={row.blocked}
              reasonDisplay="tooltip"
              onClick={() => props.onConfirmArrival(row)}
            >
              Confirm arrival <SrOnly>{row.name}</SrOnly>
            </Button>
          ) : row.when ? (
            <span className={styles.rowTime}>{row.when}</span>
          ) : null}
        </div>
      </li>
    );
  }

  function renderRows(id: string, rows: ComingRow[]) {
    const expanded = open[id] === true;
    const limit = expanded ? rows.length : foldLimit(rows.length, COMING_ROW_LIMIT);
    const hidden = expanded ? 0 : foldHidden(rows.length, COMING_ROW_LIMIT);
    return (
      <>
        <ul className={styles.rows} id={`${id}-rows`}>
          {rows.slice(0, limit).map(renderRow)}
        </ul>
        {hidden > 0 ? (
          <ShowMoreRow onClick={() => setOpen((now) => ({ ...now, [id]: true }))} controls={`${id}-rows`}>
            Show {hidden} more
          </ShowMoreRow>
        ) : null}
      </>
    );
  }

  const arrivalRows = [...arrivals, ...backFromLeave];
  return (
    <Card
      className={cx(styles.card, phone && styles.phone)}
      id="ward-flow"
      aria-labelledby="ward-coming-and-going"
      data-testid="ward-coming-and-going"
    >
      <CardHead id="ward-coming-and-going" title="Coming and going" meta={props.updated} />
      <section className={styles.group} aria-labelledby="ward-coming-arrivals">
        <GroupHead
          id="ward-coming-arrivals"
          n={arrivals.length}
          title="Arrivals"
          window="today"
          aside={backFromLeave.length > 0 ? `+ ${backFromLeave.length} back from leave` : undefined}
        />
        {arrivalRows.length === 0 ? (
          <p className={styles.empty}>Nobody expected today.</p>
        ) : (
          renderRows("ward-coming-arrivals", arrivalRows)
        )}
        {props.laterArrivals ? (
          <p className={styles.empty} data-testid="ward-coming-later">
            {props.laterArrivals} more on later days
            {props.onOpenArrivals ? (
              <>
                {" · "}
                <button type="button" className={styles.footLink} onClick={props.onOpenArrivals}>
                  All arrivals<SrOnly>, including later days</SrOnly>
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </section>
      <section className={styles.group} aria-labelledby="ward-coming-referrals">
        <GroupHead
          id="ward-coming-referrals"
          n={props.referralsWaiting}
          title="Referrals"
          window="now"
          aside={props.answeredToday > 0 ? `${props.answeredToday} answered today` : undefined}
        />
        {props.referrals}
      </section>
      <section className={styles.group} aria-labelledby="ward-coming-look">
        <GroupHead
          id="ward-coming-look"
          n={needsALook.rows.length}
          title="Needs a look"
          window="now"
          aside={needsALook.rows.length > 0 ? needsALookNote(needsALook) : undefined}
        />
        {needsALook.rows.length === 0 ? (
          <p className={styles.empty}>Nothing held up or past its date.</p>
        ) : (
          renderRows("ward-coming-look", needsALook.rows)
        )}
      </section>
      <section className={styles.group} aria-labelledby="ward-coming-out">
        <GroupHead id="ward-coming-out" n={dischargesToday.length} title="Discharges" window="today" />
        {dischargesToday.length === 0 ? (
          <p className={styles.empty}>{["None still due today.", props.lastFreed].filter(Boolean).join(" ")}</p>
        ) : (
          renderRows("ward-coming-out", dischargesToday)
        )}
      </section>
      <div className={styles.foot}>
        {props.outlook ? (
          <p data-testid="ward-tomorrow-line">
            <span className={styles.footLabel}>Tomorrow</span> {tomorrowLine(props.outlook)}
          </p>
        ) : null}
        <p className={styles.footLinks}>
          {props.onOpenArrivals ? (
            <button type="button" className={styles.footLink} onClick={props.onOpenArrivals}>
              All arrivals
            </button>
          ) : null}
          {props.onOpenDischarges ? (
            <button type="button" className={styles.footLink} onClick={props.onOpenDischarges}>
              All discharges · {props.openReleases} open
            </button>
          ) : null}
        </p>
      </div>
    </Card>
  );
}
