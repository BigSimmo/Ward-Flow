"use client";

// Wave 4 (D-191, 13 Nov 2026), Ward home's second part: "Coming and going". It replaces the Ward flow
// panel's three-way switch and the four cards under the page (This shift, Discharges today, Arrivals
// booked, Tomorrow): arrivals, referrals, beds that need a look and today's discharges sit in one list,
// each row naming the person and the bed, with Tomorrow as one foot line. Desk-aware actions: Pull the
// bed is the one filled button; the ward desk also sees Confirm arrival.

import { useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  CardHead,
  RowUndo,
  ShowMoreRow,
  SrOnly,
  StatusGlyph,
  WindowWord,
  foldHidden,
  foldLimit,
  cx,
} from "@/components/wf";
import type { WardTomorrowOutlook } from "./ward-home-outlook";
import type { ComingRow } from "./ward-coming-and-going-rows";
import styles from "./ward-coming-and-going.module.css";

/** About eight rows, then "Show N more" (design rule). */
const COMING_ROW_LIMIT = 8;

/**
 * The kit `RowUndo` on an arrival row just pulled: when the Undo window ends and the board clock it is
 * judged by, both as real moments (`calendarDateOf`), and the undo itself.
 */
export type ComingRowUndo = { until: Date; now: number; run: () => void };

export type ComingAndGoingProps = {
  /** Phone: the card sits in the page between the squares and the round. */
  phone: boolean;
  /** Fix 7 (audit three, 28 Nov 2026): Ward home no longer passes the board time here. */
  updated?: ReactNode;
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
  undoFor?: (movementId: string) => ComingRowUndo | null;
  /** Under a row whose last action the engine refused. */
  refusalFor?: (movementId: string) => ReactNode;
  onPull: (row: ComingRow) => void;
  onConfirmArrival: (row: ComingRow) => void;
  /** R-MOVE-1: release the bed pulled for a diverted person (asks first). */
  onReleaseDiverted?: (row: ComingRow) => void;
  onOpenArrival: (movementId: string) => void;
  onOpenBed: (bedNumber: number) => void;
  onOpenArrivals?: () => void;
  onOpenDischarges?: () => void;
  /**
   * Fold the Bed board into Ward (item 13): people who have left the ward and are still waiting for
   * transport (item 18), each with the board's Collected step. Their bed was freed when they left.
   */
  waitingForTransport?: { key: string; name: string; since: string; onCollected: () => void }[];
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

/** A group's head: "N Title · window", the window the kit's WindowWord. */
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
  window: Parameters<typeof WindowWord>[0]["word"];
  aside?: string;
}) {
  return (
    // tabIndex -1: focus can land here when a row it held leaves the list (review FA-2).
    <h3 className={styles.groupHead} id={id} tabIndex={-1}>
      <span className={styles.groupTitle}>
        <b className={styles.n}>{n}</b> {title}
        <WindowWord word={windowWord} />
      </span>
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
  const restPastDate = pastDate - heldUpPastDate;
  // Audit G: "more" once part of Past date sits in the held-up figure, so one label never shows two numbers.
  // A part with nothing in it is left out, so the note never reads "0 past date" (UI sweep, 16 Nov 2026).
  return [
    heldUp > 0 ? held : "",
    restPastDate > 0 ? `${restPastDate}${heldUpPastDate > 0 ? " more" : ""} past date` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function WardComingAndGoing(props: ComingAndGoingProps) {
  const { phone, arrivals, backFromLeave, needsALook, dischargesToday } = props;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // One filled button per panel (design rule), desk-aware as the mock-ups draw it: the ward desk's is
  // its first Confirm arrival (main-ward-*: Marrowvale's row), the coordinator's its first Pull the bed.
  // Only the ward desk's rows carry Confirm arrival, so the coordinator's panel is unchanged.
  const filledKey = (
    arrivals.find((row) => row.action === "confirm-arrival" && !row.blocked && !row.arriveReason) ??
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
            {/* Ruling 12 (D-191): the legal tag as recorded, in the kit's neutral Badge `tag`. */}
            {row.tag ? (
              <Badge variant="tag" size="sm" className={styles.rowTag}>
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
          {row.arriveReason ? (
            <p className={cx(styles.rowLine, styles.ink3)} data-testid={`ward-coming-arrive-reason-${row.key}`}>
              {row.arriveReason}
            </p>
          ) : null}
          {undo ? (
            <div className={styles.rowSub}>
              <RowUndo
                verb="pull"
                until={undo.until}
                now={undo.now}
                who={row.name}
                className={styles.undo}
                onUndo={undo.run}
              />
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
          ) : row.action === "release-diverted" && props.onReleaseDiverted ? (
            <Button
              variant="pri"
              size="sm"
              data-testid={`ward-coming-release-diverted-${row.key}`}
              onClick={() => props.onReleaseDiverted?.(row)}
            >
              {row.releaseLabel} <SrOnly>{row.name}</SrOnly>
            </Button>
          ) : row.action === "confirm-arrival" && row.arriveReason ? (
            <Button variant="sec" size="sm" onClick={openRow}>
              Open <SrOnly>{row.name}</SrOnly>
            </Button>
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

  // Fold the Bed board into Ward (item 13): "Pulled, not arrived", the board's figure, as the first
  // row group of the arrivals; the rest follow under their own quiet label.
  const pulledRows = arrivals.filter((row) => row.hasPulledBed);
  // Audit four item 15: people back from leave sit under their own small head, so "0 Arrivals" never
  // heads a row with a person in it (the hero's Arrivals figure stays 0 too, D-191 item 9).
  const notPulledRows = arrivals.filter((row) => !row.hasPulledBed);
  const transportWait = props.waitingForTransport ?? [];
  // Audit three #23 (28 Nov 2026): a group at zero goes, as the hero and tabs already say it. Referrals
  // stays: it is the focus and tour anchor (#ward-awaiting-answer) and carries the decline notice.
  // Gate r10 (2 upgrade 7): Back from leave is its own group, a peer of Arrivals with the same head,
  // so Arrivals shows only for arrivals (a group at zero goes, audit three #23).
  const showArrivals = pulledRows.length + notPulledRows.length > 0 || (props.laterArrivals ?? 0) > 0;
  const showLook = needsALook.rows.length > 0;
  const showOut = dischargesToday.length > 0;
  return (
    <Card
      className={cx(styles.card, phone && styles.phone)}
      id="ward-flow"
      aria-labelledby="ward-coming-and-going"
      data-testid="ward-coming-and-going"
    >
      <CardHead id="ward-coming-and-going" title="Coming and going" meta={props.updated} />
      {showArrivals ? (
        <section className={styles.group} aria-labelledby="ward-coming-arrivals">
          <GroupHead id="ward-coming-arrivals" n={arrivals.length} title="Arrivals" window="today" />
          {pulledRows.length + notPulledRows.length === 0 ? (
            <p className={styles.empty}>Nobody expected today.</p>
          ) : pulledRows.length === 0 ? (
            notPulledRows.length > 0 ? (
              renderRows("ward-coming-arrivals", notPulledRows)
            ) : null
          ) : (
            <>
              <h4 className={styles.subHead} data-testid="ward-coming-pulled">
                <b className={styles.n}>{pulledRows.length}</b> Pulled, not arrived
              </h4>
              {renderRows("ward-coming-pulled", pulledRows)}
              {notPulledRows.length > 0 ? (
                <>
                  <h4 className={styles.subHead}>
                    <b className={styles.n}>{notPulledRows.length}</b> Bed not pulled yet
                  </h4>
                  {renderRows("ward-coming-arrivals", notPulledRows)}
                </>
              ) : null}
            </>
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
      ) : null}
      {backFromLeave.length > 0 ? (
        <section
          className={styles.group}
          aria-labelledby="ward-coming-back-from-leave"
          data-testid="ward-coming-back-from-leave"
        >
          <GroupHead id="ward-coming-back-from-leave" n={backFromLeave.length} title="Back from leave" window="today" />
          {renderRows("ward-coming-back-from-leave", backFromLeave)}
        </section>
      ) : null}
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
      {showLook ? (
        <section className={styles.group} aria-labelledby="ward-coming-look">
          <GroupHead
            id="ward-coming-look"
            n={needsALook.rows.length}
            title="Needs a look"
            window="now"
            aside={needsALook.rows.length > 0 ? needsALookNote(needsALook) : undefined}
          />
          {renderRows("ward-coming-look", needsALook.rows)}
        </section>
      ) : null}
      {showOut ? (
        <section className={styles.group} aria-labelledby="ward-coming-out">
          <GroupHead id="ward-coming-out" n={dischargesToday.length} title="Expected to leave" window="today" />
          {renderRows("ward-coming-out", dischargesToday)}
        </section>
      ) : null}
      {transportWait.length > 0 ? (
        <section
          className={styles.group}
          aria-labelledby="ward-coming-transport"
          data-testid="ward-coming-transport-wait"
        >
          <GroupHead
            id="ward-coming-transport"
            n={transportWait.length}
            title="Waiting for transport"
            window="now"
            aside="Left the ward; bed freed"
          />
          <ul className={styles.rows}>
            {transportWait.map((entry) => (
              <li key={entry.key} className={styles.row} data-testid={`ward-coming-transport-${entry.key}`}>
                <span className={styles.rowGlyph}>
                  <StatusGlyph tone="info" size={9} />
                </span>
                <div className={styles.rowMain}>
                  <p className={styles.rowTop}>
                    <span className={styles.rowName}>{entry.name}</span>
                  </p>
                  <p className={cx(styles.rowLine, styles.ink3)}>Waiting since {entry.since}</p>
                </div>
                <div className={styles.rowAct}>
                  <Button variant="sec" size="sm" onClick={entry.onCollected}>
                    Collected <SrOnly>{entry.name}</SrOnly>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className={styles.foot}>
        {!showOut && props.lastFreed ? <p data-testid="ward-coming-last-freed">{props.lastFreed}</p> : null}
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
